"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { GOAL_KEY } from "@/lib/inserimenti/constants";
import { applySaleToClient } from "@/lib/inserimenti/apply-sale-to-client";
import { missingRequiredSaleData } from "@/lib/inserimenti/sale-required-data";
import { subtypeDaOfferta } from "@/lib/inserimenti/accesso-subtypes";
import {
  searchCounterClients,
  createCounterClient,
  type CounterClientHit,
  type CounterClientResult,
} from "@/lib/inserimenti/counter-client";

const BRANDS = ["TIM", "KENA", "FASTWEB", "ENEL", "ENI", "ILIAD"] as const;
type Brand = (typeof BRANDS)[number];

/** "YYYY-MM" dal valore date "YYYY-MM-DD". */
function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

const num = (v: FormDataEntryValue | null): number | null => {
  if (v == null) return null;
  const x = parseFloat(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : null;
};

/** Registra una vendita al banco. Ritorna { error } oppure { id } (per l'undo). */
export async function recordSale(formData: FormData): Promise<{ error: string } | { id: string }> {
  const session = await requireFullAdmin();

  const brand = String(formData.get("brand") ?? "") as Brand;
  if (!BRANDS.includes(brand)) return { error: "Brand non valido." };

  const lineKey = String(formData.get("lineKey") ?? "").trim();
  if (!lineKey) return { error: "Seleziona una pista." };

  const dateStr = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "Data non valida." };

  const feeEur = num(formData.get("feeEur"));
  const feeSource = formData.get("feeSource") === "MANUALE" ? "MANUALE" : "LISTINO";
  const domiciled = formData.get("domiciled") === "on" || formData.get("domiciled") === "true";
  const offerCode = (String(formData.get("offerCode") ?? "").trim() || null) as string | null;
  const provenanceRaw = String(formData.get("provenance") ?? "").trim();
  // Il sottotipo si deduce dall'offerta quando il listino lo dice già: sceglier
  // «FWA Ricaricabile pack» e poi dover ripetere «tipo: FWA ricaricabile» è una
  // trappola, e chi registra la salta. Senza sottotipo la vendita pesa un punto
  // invece di mezzo e sballa i cancelli del Top Club.
  const subtypeForm = (String(formData.get("subtype") ?? "").trim() || null) as string | null;
  const subtype = subtypeForm ?? subtypeDaOfferta(offerCode);
  const notes = (String(formData.get("notes") ?? "").trim() || null) as string | null;

  const PROVS = ["ILIAD", "COOP", "POSTE", "FASTWEB", "KENA", "ALTRO"];
  const provenance = PROVS.includes(provenanceRaw) ? (provenanceRaw as Prisma.StoreSaleCreateInput["provenance"]) : null;

  // Aggancio CRM OPZIONALE: se il banco ha selezionato un cliente, lo salviamo
  // e (più sotto) attiviamo il servizio sulla sua scheda. Mai obbligatorio.
  const clientId = (String(formData.get("clientId") ?? "").trim() || null) as string | null;

  // RIFIUTO ALL'INGRESSO. Un sistema che calcola soldi non accetta un dato
  // ambiguo per poi avvisare dopo: se senza quel campo il numero è sbagliato,
  // il campo si chiede adesso — quando il cliente è ancora davanti al banco.
  // La regola è la stessa che il cruscotto usa per segnalare le righe vecchie:
  // una sola, così non possono contraddirsi.
  const line = await prisma.incentiveLine.findFirst({
    where: { key: lineKey, plan: { ownerUserId: session.user.id, brand, month: monthOf(dateStr) } },
    select: { unit: true },
  });
  if (line) {
    const offerPrices = await prisma.storeOffer.findMany({
      where: {
        ownerUserId: session.user.id,
        brand: brand as Prisma.StoreOfferWhereInput["brand"],
        lineKey,
        compensoEur: { not: null },
      },
      select: { compensoEur: true },
    });
    const missing = missingRequiredSaleData({
      lineKey,
      lineUnit: line.unit,
      subtype,
      offerCode,
      feeEur,
      provenance,
      offerPricesForLine: offerPrices.map((o) => Number(o.compensoEur)),
    });
    if (missing) return { error: missing.message };
  }

  const created = await prisma.storeSale.create({
    data: {
      ownerUserId: session.user.id,
      date: new Date(`${dateStr}T00:00:00.000Z`),
      month: monthOf(dateStr),
      brand,
      lineKey,
      offerCode,
      feeEur: feeEur == null ? null : new Prisma.Decimal(feeEur),
      feeSource,
      domiciled,
      provenance,
      subtype,
      notes,
      clientId,
    },
    select: { id: true },
  });

  // Ponte vendita→CRM: attiva il servizio sulla scheda del cliente e fa
  // scattare la propagazione (esce dalle campagne del servizio che ora ha).
  // ATTESO, non più fire-and-forget: su serverless la funzione può terminare
  // appena inviata la risposta e la propagazione non avverrebbe mai. Costa
  // poche query. L'errore resta ingoiato: il banco non si blocca per il CRM.
  if (clientId) {
    await applySaleToClient({
      clientId,
      sale: {
        brand,
        lineKey,
        subtype,
        offerCode,
        feeEur,
        ownerUserId: session.user.id,
      },
    }).catch(() => {});
  }

  revalidatePath("/admin/inserimenti");
  revalidatePath("/admin/inserimenti/registra");
  return { id: created.id };
}

/** Modifica una vendita esistente. Stessi controlli di recordSale. */
export async function updateSale(id: string, formData: FormData): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();

  const existing = await prisma.storeSale.findFirst({ where: { id, ownerUserId: session.user.id } });
  if (!existing) return { error: "Vendita non trovata." };

  const brand = String(formData.get("brand") ?? "") as Brand;
  if (!BRANDS.includes(brand)) return { error: "Brand non valido." };

  const lineKey = String(formData.get("lineKey") ?? "").trim();
  if (!lineKey) return { error: "Seleziona una pista." };

  const dateStr = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "Data non valida." };

  const feeEur = num(formData.get("feeEur"));
  const domiciled = formData.get("domiciled") === "on" || formData.get("domiciled") === "true";
  const provenanceRaw = String(formData.get("provenance") ?? "").trim();
  const PROVS = ["ILIAD", "COOP", "POSTE", "FASTWEB", "KENA", "ALTRO"];
  const provenance = PROVS.includes(provenanceRaw) ? (provenanceRaw as Prisma.StoreSaleCreateInput["provenance"]) : null;
  // offerta della vendita: dove il compenso è per-offerta (Fastweb) è il dato
  // che decide quanto paga. Assente dal form = non toccare; "" = scollega.
  const offerCodeRaw = formData.get("offerCode");
  const offerCode = offerCodeRaw == null ? undefined : String(offerCodeRaw).trim() || null;

  await prisma.storeSale.update({
    where: { id },
    data: {
      date: new Date(`${dateStr}T00:00:00.000Z`),
      month: monthOf(dateStr),
      brand,
      lineKey,
      feeEur: feeEur == null ? null : new Prisma.Decimal(feeEur),
      feeSource: feeEur == null ? existing.feeSource : "MANUALE",
      domiciled,
      provenance,
      ...(offerCode !== undefined ? { offerCode } : {}),
    },
  });

  revalidatePath("/admin/inserimenti");
  revalidatePath("/admin/inserimenti/registra");
  return null;
}

/** Completa il canone di una vendita registrata senza (lista "canoni mancanti"
 *  della Gara TIM): tocca solo feeEur, tutto il resto resta com'è. */
export async function setSaleFee(id: string, value: string): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  const sale = await prisma.storeSale.findFirst({ where: { id, ownerUserId: session.user.id } });
  if (!sale) return { error: "Vendita non trovata." };
  const fee = num(value);
  if (fee == null || fee < 0) return { error: "Canone non valido." };
  await prisma.storeSale.update({
    where: { id },
    data: { feeEur: new Prisma.Decimal(fee), feeSource: "MANUALE" },
  });
  revalidatePath("/admin/inserimenti");
  revalidatePath("/admin/inserimenti/gara-tim");
  revalidatePath("/admin/inserimenti/registra");
  return null;
}

/** Elimina una vendita. */
export async function deleteSale(id: string): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  const sale = await prisma.storeSale.findFirst({ where: { id, ownerUserId: session.user.id } });
  if (!sale) return { error: "Vendita non trovata." };
  await prisma.storeSale.delete({ where: { id } });
  revalidatePath("/admin/inserimenti");
  revalidatePath("/admin/inserimenti/registra");
  return null;
}

/** Aggiorna un'offerta di listino (canone, pista suggerita, attiva). */
export async function updateOffer(
  id: string,
  patch: { feeEur?: string; compensoEur?: string; lineKey?: string; active?: boolean },
): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  const offer = await prisma.storeOffer.findFirst({ where: { id, ownerUserId: session.user.id } });
  if (!offer) return { error: "Offerta non trovata." };

  const fee = patch.feeEur == null ? null : num(patch.feeEur);
  if (patch.feeEur != null && (fee == null || fee < 0)) return { error: "Canone non valido." };

  // compenso vuoto = torna a usare quello della pista
  let compenso: Prisma.Decimal | null | undefined;
  if (patch.compensoEur !== undefined) {
    const c = patch.compensoEur.trim() ? num(patch.compensoEur) : null;
    if (patch.compensoEur.trim() && (c == null || c < 0)) return { error: "Compenso non valido." };
    compenso = c == null ? null : new Prisma.Decimal(c);
  }

  await prisma.storeOffer.update({
    where: { id },
    data: {
      ...(fee != null ? { feeEur: new Prisma.Decimal(fee) } : {}),
      ...(compenso !== undefined ? { compensoEur: compenso } : {}),
      ...(patch.lineKey !== undefined ? { lineKey: patch.lineKey || null } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    },
  });

  revalidatePath("/admin/inserimenti/listino");
  revalidatePath("/admin/inserimenti/registra");
  return null;
}

/** Imposta (o azzera) l'obiettivo personale di compensi del mese. */
export async function setMonthlyGoal(month: string, value: string): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mese non valido." };
  const amount = num(value) ?? 0;
  if (amount < 0) return { error: "L'obiettivo non può essere negativo." };

  if (amount === 0) {
    await prisma.storeMonthlyInput.deleteMany({
      where: { ownerUserId: session.user.id, month, key: GOAL_KEY },
    });
  } else {
    await prisma.storeMonthlyInput.upsert({
      where: { ownerUserId_month_key: { ownerUserId: session.user.id, month, key: GOAL_KEY } },
      update: { value: new Prisma.Decimal(amount) },
      create: { ownerUserId: session.user.id, month, key: GOAL_KEY, value: new Prisma.Decimal(amount) },
    });
  }

  revalidatePath("/admin/inserimenti");
  return null;
}

/** Piste registrabili per ogni brand del mese, per popolare il form. */
export async function lineOptionsForMonth(ownerUserId: string, month: string) {
  const plans = await prisma.incentivePlan.findMany({
    where: { ownerUserId, month },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
    orderBy: { brand: "asc" },
  });
  return plans.map((p) => ({
    brand: p.brand,
    label: p.label,
    lines: p.lines.map((l) => ({
      key: l.key,
      label: l.label,
      unit: l.unit,
      status: l.status,
    })),
  }));
}

/** Ricerca cliente dal banco: nome o telefono. */
export async function searchClientsForCounter(q: string): Promise<CounterClientHit[]> {
  await requireFullAdmin();
  return searchCounterClients(q);
}

/** Crea (o riusa, sul telefono) il cliente dal banco con due campi. */
export async function createClientFromCounter(
  name: string,
  phone: string
): Promise<CounterClientResult> {
  const session = await requireFullAdmin();
  return createCounterClient({ ownerUserId: session.user.id, name, phone });
}

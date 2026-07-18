"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { GOAL_KEY } from "@/lib/inserimenti/constants";

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
  const subtype = (String(formData.get("subtype") ?? "").trim() || null) as string | null;
  const notes = (String(formData.get("notes") ?? "").trim() || null) as string | null;

  const PROVS = ["ILIAD", "COOP", "POSTE", "FASTWEB", "KENA", "ALTRO"];
  const provenance = PROVS.includes(provenanceRaw) ? (provenanceRaw as Prisma.StoreSaleCreateInput["provenance"]) : null;

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
    },
    select: { id: true },
  });

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
    },
  });

  revalidatePath("/admin/inserimenti");
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
  patch: { feeEur?: string; lineKey?: string; active?: boolean },
): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  const offer = await prisma.storeOffer.findFirst({ where: { id, ownerUserId: session.user.id } });
  if (!offer) return { error: "Offerta non trovata." };

  const fee = patch.feeEur == null ? null : num(patch.feeEur);
  if (patch.feeEur != null && (fee == null || fee < 0)) return { error: "Canone non valido." };

  await prisma.storeOffer.update({
    where: { id },
    data: {
      ...(fee != null ? { feeEur: new Prisma.Decimal(fee) } : {}),
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

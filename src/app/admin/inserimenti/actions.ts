"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

/** Registra una vendita al banco. Ritorna { error } | null (convenzione Onizuka). */
export async function recordSale(formData: FormData): Promise<{ error: string } | null> {
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

  await prisma.storeSale.create({
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

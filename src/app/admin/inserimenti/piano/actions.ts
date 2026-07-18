"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const x = parseFloat(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : null;
};

/**
 * Duplica i piani di un mese sul mese successivo, in stato PROVISIONAL.
 *
 * È il gesto che rende il modulo autonomo: la lettera di gara arriva sempre a
 * mese già iniziato (§A.12), quindi si parte dalle regole del mese scorso e si
 * correggono i numeri quando la lettera arriva. Tutto si ricalcola da solo,
 * perché i compensi sono derivati e mai congelati sulla vendita.
 */
export async function duplicatePlans(fromMonth: string, toMonth: string): Promise<{ error: string } | { count: number }> {
  const session = await requireFullAdmin();
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth)) return { error: "Mese non valido." };
  if (fromMonth === toMonth) return { error: "I due mesi coincidono." };

  const sources = await prisma.incentivePlan.findMany({
    where: { ownerUserId: session.user.id, month: fromMonth },
    include: {
      lines: { include: { tiers: true } },
      params: true,
      prizes: { include: { gates: true, scoreKpis: true, bonuses: true, halvings: true } },
    },
  });
  if (!sources.length) return { error: `Nessun piano da copiare per ${fromMonth}.` };

  let count = 0;
  for (const src of sources) {
    const exists = await prisma.incentivePlan.findUnique({
      where: { ownerUserId_brand_month: { ownerUserId: session.user.id, brand: src.brand, month: toMonth } },
    });
    if (exists) continue; // non sovrascrive mai un piano già presente

    await prisma.incentivePlan.create({
      data: {
        ownerUserId: session.user.id,
        brand: src.brand,
        month: toMonth,
        label: src.label.replace(fromMonth, toMonth),
        status: "PROVISIONAL",
        engineVersion: src.engineVersion,
        copiedFromPlanId: src.id,
        notes: `Duplicato da ${fromMonth}. Correggi i numeri quando arriva la lettera, poi conferma.`,
        lines: {
          create: src.lines.map((l) => ({
            key: l.key,
            label: l.label,
            category: l.category,
            unit: l.unit,
            hasTiers: l.hasTiers,
            target: l.target,
            revenueEur: l.revenueEur,
            status: l.status,
            statusNote: l.statusNote,
            rules: l.rules,
            sortOrder: l.sortOrder,
            tiers: { create: l.tiers.map((t) => ({ minQty: t.minQty, value: t.value })) },
          })),
        },
        params: { create: src.params.map((p) => ({ key: p.key, valueJson: p.valueJson as Prisma.InputJsonValue })) },
        prizes: {
          create: src.prizes.map((pr) => ({
            key: pr.key,
            label: pr.label,
            minPoints: pr.minPoints,
            maxPoints: pr.maxPoints,
            minPrize: pr.minPrize,
            maxPrize: pr.maxPrize,
            rules: pr.rules,
            gates: { create: pr.gates.map((g) => ({ lineKey: g.lineKey, minQty: g.minQty })) },
            scoreKpis: {
              create: pr.scoreKpis.map((k) => ({
                key: k.key,
                label: k.label,
                points: k.points,
                source: k.source,
                sortOrder: k.sortOrder,
              })),
            },
            bonuses: {
              create: pr.bonuses.map((b) => ({
                conditionLineKey: b.conditionLineKey,
                conditionMinQty: b.conditionMinQty,
                pct: b.pct,
                label: b.label,
              })),
            },
            halvings: {
              create: pr.halvings.map((h) => ({
                inputKey: h.inputKey,
                minValue: h.minValue,
                factor: h.factor,
                label: h.label,
              })),
            },
          })),
        },
      },
    });
    count++;
  }

  revalidatePath("/admin/inserimenti/piano");
  revalidatePath("/admin/inserimenti");
  return { count };
}

/** Conferma un piano provvisorio (la lettera è arrivata) o lo archivia. */
export async function setPlanStatus(
  planId: string,
  status: "PROVISIONAL" | "ACTIVE" | "ARCHIVED",
): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  const plan = await prisma.incentivePlan.findFirst({ where: { id: planId, ownerUserId: session.user.id } });
  if (!plan) return { error: "Piano non trovato." };
  await prisma.incentivePlan.update({ where: { id: planId }, data: { status } });
  revalidatePath("/admin/inserimenti/piano");
  revalidatePath("/admin/inserimenti");
  return null;
}

/** Aggiorna una pista: obiettivo, stato di abilitazione, regole in chiaro. */
export async function updateLine(
  lineId: string,
  patch: { target?: string; status?: string; statusNote?: string; rules?: string; label?: string },
): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  const line = await prisma.incentiveLine.findFirst({
    where: { id: lineId, plan: { ownerUserId: session.user.id } },
  });
  if (!line) return { error: "Pista non trovata." };

  const STATI = ["ATTIVA", "IN_ABILITAZIONE", "NON_ABILITATA", "BLOCCATA"];
  await prisma.incentiveLine.update({
    where: { id: lineId },
    data: {
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.target !== undefined ? { target: patch.target.trim() ? Math.round(num(patch.target) ?? 0) : null } : {}),
      ...(patch.status !== undefined && STATI.includes(patch.status) ? { status: patch.status as never } : {}),
      ...(patch.statusNote !== undefined ? { statusNote: patch.statusNote.trim() || null } : {}),
      ...(patch.rules !== undefined ? { rules: patch.rules.trim() || null } : {}),
    },
  });
  revalidatePath("/admin/inserimenti/piano");
  revalidatePath("/admin/inserimenti");
  return null;
}

/** Aggiorna gli scaglioni di una pista: è il gesto del cambio mese. */
export async function replaceTiers(
  lineId: string,
  tiers: { minQty: string; value: string }[],
): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  const line = await prisma.incentiveLine.findFirst({
    where: { id: lineId, plan: { ownerUserId: session.user.id } },
  });
  if (!line) return { error: "Pista non trovata." };

  const parsed = tiers
    .map((t) => ({ minQty: Math.round(num(t.minQty) ?? -1), value: num(t.value) }))
    .filter((t) => t.minQty >= 0 && t.value != null) as { minQty: number; value: number }[];

  if (!parsed.length) return { error: "Serve almeno uno scaglione." };
  const mins = new Set(parsed.map((t) => t.minQty));
  if (mins.size !== parsed.length) return { error: "Ci sono soglie duplicate." };

  await prisma.$transaction([
    prisma.incentiveTier.deleteMany({ where: { lineId } }),
    prisma.incentiveTier.createMany({
      data: parsed.map((t) => ({ lineId, minQty: t.minQty, value: new Prisma.Decimal(t.value) })),
    }),
  ]);

  revalidatePath("/admin/inserimenti/piano");
  revalidatePath("/admin/inserimenti");
  return null;
}

/** Aggiorna i cancelli di un premio (quantità minime). */
export async function updateGate(gateId: string, minQty: string): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  const gate = await prisma.incentiveGate.findFirst({
    where: { id: gateId, prize: { plan: { ownerUserId: session.user.id } } },
  });
  if (!gate) return { error: "Cancello non trovato." };
  const v = Math.round(num(minQty) ?? -1);
  if (v < 0) return { error: "Valore non valido." };
  await prisma.incentiveGate.update({ where: { id: gateId }, data: { minQty: v } });
  revalidatePath("/admin/inserimenti/piano");
  revalidatePath("/admin/inserimenti");
  return null;
}

/** Salva gli input mensili (KPI Customer Base, ratio, volumi). */
export async function saveMonthlyInputs(
  month: string,
  values: Record<string, string>,
): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mese non valido." };

  for (const [key, raw] of Object.entries(values)) {
    const v = num(raw);
    if (v == null || v === 0) {
      await prisma.storeMonthlyInput.deleteMany({ where: { ownerUserId: session.user.id, month, key } });
      continue;
    }
    await prisma.storeMonthlyInput.upsert({
      where: { ownerUserId_month_key: { ownerUserId: session.user.id, month, key } },
      update: { value: new Prisma.Decimal(v) },
      create: { ownerUserId: session.user.id, month, key, value: new Prisma.Decimal(v) },
    });
  }

  revalidatePath("/admin/inserimenti/mese");
  revalidatePath("/admin/inserimenti");
  return null;
}

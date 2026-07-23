/**
 * Seed del modulo Inserimenti: piani provvigionali + (facoltativo) listino.
 * Idempotente: cancella e riscrive i piani del mese per l'owner, così rilanciarlo
 * dopo aver corretto plan-luglio-2026.ts aggiorna i dati senza duplicati.
 */

import { prisma } from "@/lib/prisma";
import { PLANS_LUGLIO_2026, type SeedPlan } from "./plan-luglio-2026";
import { Prisma } from "@prisma/client";

async function seedPlan(ownerUserId: string, plan: SeedPlan) {
  // rimpiazza il piano del mese (cascade pulisce lines/tiers/prizes/params)
  await prisma.incentivePlan.deleteMany({
    where: { ownerUserId, brand: plan.brand, month: plan.month },
  });

  const created = await prisma.incentivePlan.create({
    data: {
      ownerUserId,
      brand: plan.brand,
      month: plan.month,
      label: plan.label,
      sourceDoc: plan.sourceDoc,
      status: plan.status,
      engineVersion: plan.engineVersion,
      notes: plan.notes,
      lines: {
        create: plan.lines.map((l) => ({
          key: l.key,
          label: l.label,
          category: l.category,
          unit: l.unit,
          hasTiers: l.hasTiers,
          target: l.target,
          status: l.status ?? "ATTIVA",
          statusNote: l.statusNote,
          rules: l.rules,
          sortOrder: l.sortOrder,
          tiers: {
            create: l.tiers.map((t) => ({ minQty: t.minQty, value: new Prisma.Decimal(t.value) })),
          },
        })),
      },
      params: {
        create: plan.params.map((p) => ({ key: p.key, valueJson: p.valueJson as Prisma.InputJsonValue })),
      },
      prizes: {
        create: plan.prizes.map((pr) => ({
          key: pr.key,
          label: pr.label,
          minPoints: new Prisma.Decimal(pr.minPoints),
          maxPoints: new Prisma.Decimal(pr.maxPoints),
          minPrize: new Prisma.Decimal(pr.minPrize),
          maxPrize: new Prisma.Decimal(pr.maxPrize),
          rules: pr.rules,
          gates: { create: pr.gates.map((g) => ({ lineKey: g.lineKey, minQty: g.minQty })) },
          scoreKpis: {
            create: pr.scoreKpis.map((k) => ({
              key: k.key,
              label: k.label,
              points: new Prisma.Decimal(k.points),
              source: k.source,
              sortOrder: k.sortOrder,
            })),
          },
          bonuses: {
            create: pr.bonuses.map((b) => ({
              conditionLineKey: b.conditionLineKey,
              conditionMinQty: b.conditionMinQty,
              pct: new Prisma.Decimal(b.pct),
              label: b.label,
            })),
          },
          halvings: {
            create: pr.halvings.map((h) => ({
              inputKey: h.inputKey,
              minValue: new Prisma.Decimal(h.minValue),
              factor: new Prisma.Decimal(h.factor),
              label: h.label,
            })),
          },
        })),
      },
    },
    include: { lines: true, prizes: true },
  });

  return { brand: plan.brand, lines: created.lines.length, prizes: created.prizes.length };
}

/** Semina tutti i piani di luglio per l'owner dato (l'admin/Lorenzo). */
export async function seedInserimentiPlans(ownerUserId: string) {
  const results = [];
  for (const plan of PLANS_LUGLIO_2026) {
    results.push(await seedPlan(ownerUserId, plan));
  }
  return results;
}

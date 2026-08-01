/**
 * Crea il piano di AGOSTO 2026 copiando quello di luglio, per tutti i brand.
 *
 * Decisione di Lorenzo (01/08/2026): finché TIM non manda la lettera di agosto,
 * si lavora con i valori di luglio. Il piano nasce quindi come copia, con
 * `copiedFromPlanId` valorizzato e lo stato PROVISIONAL — così è evidente in UI
 * che i numeri sono ereditati e non confermati.
 *
 * ⚠️ Da rifare appena arriva la lettera di agosto: le soglie sono cambiate fra
 * giugno e luglio senza preavviso, e a luglio ci è costato un mese di conti
 * sbagliati. Il piano del mese si costruisce LEGGENDO la lettera, non
 * ereditando quello prima.
 *
 * Idempotente: se il piano di agosto esiste già, non tocca niente.
 *   npx tsx scripts/crea-piano-agosto-2026.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DA = "2026-07";
const A = "2026-08";

async function main() {
  const sorgenti = await prisma.incentivePlan.findMany({
    where: { month: DA },
    include: {
      lines: { include: { tiers: true } },
      prizes: { include: { gates: true, scoreKpis: true, bonuses: true, halvings: true } },
      params: true,
    },
  });
  if (!sorgenti.length) throw new Error(`nessun piano di ${DA} da copiare`);

  for (const p of sorgenti) {
    const esiste = await prisma.incentivePlan.findUnique({
      where: { ownerUserId_brand_month: { ownerUserId: p.ownerUserId, brand: p.brand, month: A } },
    });
    if (esiste) {
      console.log(`  ${p.brand}: piano di ${A} già presente, non tocco niente`);
      continue;
    }
    await prisma.incentivePlan.create({
      data: {
        ownerUserId: p.ownerUserId,
        brand: p.brand,
        month: A,
        label: p.label.replace("Luglio", "Agosto").replace("luglio", "agosto"),
        sourceDoc: `Copia del piano ${DA} — lettera di agosto non ancora ricevuta`,
        status: "PROVISIONAL",
        engineVersion: p.engineVersion,
        copiedFromPlanId: p.id,
        notes:
          `⚠️ VALORI EREDITATI DA ${DA}, NON CONFERMATI. Creato il 01/08/2026 su decisione di Lorenzo: ` +
          `si lavora con i numeri di luglio finché TIM non manda la lettera di agosto. ` +
          `Appena arriva, riverificare soglia per soglia: fra giugno e luglio erano già cambiate. ` +
          (p.notes ? `\n\nNote del piano di origine:\n${p.notes}` : ""),
        lines: {
          create: p.lines.map((l) => ({
            key: l.key,
            label: l.label,
            category: l.category,
            unit: l.unit,
            hasTiers: l.hasTiers,
            target: l.target,
            status: l.status,
            statusNote: l.statusNote,
            rules: l.rules,
            sortOrder: l.sortOrder,
            tiers: { create: l.tiers.map((t) => ({ minQty: t.minQty, value: t.value })) },
          })),
        },
        prizes: {
          create: p.prizes.map((pr) => ({
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
                sourceLineKey: k.sourceLineKey,
                matchSubtype: k.matchSubtype,
                excludeSubtype: k.excludeSubtype,
                excludeSubtypeIn: k.excludeSubtypeIn,
                provenanceIn: k.provenanceIn,
                provenanceNotIn: k.provenanceNotIn,
                minFeeEur: k.minFeeEur,
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
        params: { create: p.params.map((x) => ({ key: x.key, valueJson: x.valueJson as never })) },
      },
    });
    console.log(`  ${p.brand}: piano di ${A} creato (${p.lines.length} piste, ${p.prizes.length} premi)`);
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

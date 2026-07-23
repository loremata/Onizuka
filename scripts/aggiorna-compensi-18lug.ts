/**
 * Applica ai piani le risposte di Lorenzo del 18/07/2026.
 *
 *  1. Fastweb Energia          → 100 €/pezzo (provvisorio, in attesa di lettera)
 *  2. Fastweb business         → 5 × canone  (fisso, mobile, energia business)
 * 11. Iliad                    → 1 × canone  (compenso = spesa mensile)
 *  9. Enel                     → 90 € a contratto, luce e gas uguali (dual = 2 pezzi)
 * 12. TIM Telepass TWIN/Europa → piste proprie, registrabili al banco
 *
 * Uso: npx tsx scripts/aggiorna-compensi-18lug.ts
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const D = (n: number) => new Prisma.Decimal(n);

/** Imposta una pista lineare: unità, valore unico, regole. */
async function setLine(
  brand: "TIM" | "FASTWEB" | "ENEL" | "ENI" | "ILIAD",
  key: string,
  opts: { unit: "EUR_PER_PIECE" | "MULTIPLIER_ON_FEE"; value: number; rules?: string; label?: string },
) {
  const lines = await prisma.incentiveLine.findMany({
    where: { key, plan: { brand } },
    select: { id: true },
  });
  for (const l of lines) {
    await prisma.incentiveLine.update({
      where: { id: l.id },
      data: {
        unit: opts.unit,
        ...(opts.label ? { label: opts.label } : {}),
        ...(opts.rules ? { rules: opts.rules } : {}),
      },
    });
    await prisma.incentiveTier.deleteMany({ where: { lineId: l.id } });
    await prisma.incentiveTier.create({ data: { lineId: l.id, minQty: 0, value: D(opts.value) } });
  }
  return lines.length;
}

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("Nessun utente ADMIN");
  const log: string[] = [];

  // 1 · Fastweb Energia: 100 €/pezzo
  log.push(
    `Fastweb ENERGIA → 100 €/pz: ${await setLine("FASTWEB", "ENERGIA", {
      unit: "EUR_PER_PIECE",
      value: 100,
      rules: "100 € a contratto (provvisorio, 18/07/2026). Da aggiornare con la lettera di incentivazione.",
    })} piste`,
  );

  // 2 · Fastweb business: 5 × canone
  for (const k of ["FISSO_BUSINESS", "MOBILE_BUSINESS", "ENERGIA_BUSINESS"]) {
    log.push(
      `Fastweb ${k} → 5 × canone: ${await setLine("FASTWEB", k, {
        unit: "MULTIPLIER_ON_FEE",
        value: 5,
        rules:
          "Compenso = 5 × canone mensile (provvisorio, 18/07/2026). Serve il canone alla registrazione. Da aggiornare con la lettera.",
      })} piste`,
    );
  }

  // 11 · Iliad: compenso = canone (moltiplicatore 1). Vale per privato e business,
  // qualunque offerta: non serve caricare il catalogo per calcolare.
  log.push(
    `Iliad MNP → 1 × canone: ${await setLine("ILIAD", "MNP", {
      unit: "MULTIPLIER_ON_FEE",
      value: 1,
      label: "Iliad (privato e business)",
      rules:
        "Compenso = spesa mensile dell'offerta venduta (1 × canone). Vale per tutte le offerte, privato e business: inserisci il canone alla registrazione.",
    })} piste`,
  );

  // 9 · Enel: 90 € a contratto, luce e gas uguali → un dual sono 2 righe da 90.
  log.push(
    `Enel ENERGIA → 90 €/contratto: ${await setLine("ENEL", "ENERGIA", {
      unit: "EUR_PER_PIECE",
      value: 90,
      label: "Enel Energia (luce o gas)",
      rules: "90 € a contratto, uguale per luce e per gas. Un dual luce+gas = 2 contratti = 180 €.",
    })} piste`,
  );

  // 12 · TIM Telepass TWIN e Assistenza Europa: diventano piste proprie, così
  // sono registrabili al banco. Vanno tolte dagli "extras" per non contarle due volte.
  const timPlans = await prisma.incentivePlan.findMany({
    where: { ownerUserId: owner.id, brand: "TIM" },
    include: { lines: true, params: true },
  });
  for (const plan of timPlans) {
    const nuove = [
      { key: "TELEPASS_TWIN", label: "Telepass TWIN", value: 10, sortOrder: 71 },
      { key: "TELEPASS_EUROPA", label: "Telepass Assistenza Europa", value: 5, sortOrder: 72 },
    ];
    for (const n of nuove) {
      if (plan.lines.some((l) => l.key === n.key)) continue;
      await prisma.incentiveLine.create({
        data: {
          planId: plan.id,
          key: n.key,
          label: n.label,
          category: "Telepass",
          unit: "EUR_PER_PIECE",
          hasTiers: false,
          status: "ATTIVA",
          rules: `Gettone fisso ${n.value} € per pezzo, senza soglie. Servizio aggiuntivo sul contratto Telepass.`,
          sortOrder: n.sortOrder,
          tiers: { create: [{ minQty: 0, value: D(n.value) }] },
        },
      });
    }

    // togli TWIN ed EUROPA dagli extras: ora li calcola la pista
    const extras = plan.params.find((p) => p.key === "extras");
    if (extras) {
      const arr = (extras.valueJson as Array<{ matchLineKey?: string }>).filter(
        (e) => e.matchLineKey !== "TELEPASS_TWIN" && e.matchLineKey !== "TELEPASS_EUROPA",
      );
      await prisma.incentiveParam.update({
        where: { id: extras.id },
        data: { valueJson: arr as Prisma.InputJsonValue },
      });
    }
  }
  log.push(`TIM: piste TWIN/Europa create su ${timPlans.length} piani, rimosse dagli extras`);

  console.log(log.join("\n"));

  // 13 · elenco delle offerte TIM senza pista, da mappare a mano
  const senzaPista = await prisma.storeOffer.findMany({
    where: { ownerUserId: owner.id, brand: "TIM", lineKey: null },
    orderBy: [{ category: "asc" }, { feeEur: "asc" }],
    select: { name: true, category: true, feeEur: true },
  });
  console.log(`\n--- ${senzaPista.length} offerte TIM SENZA PISTA (da assegnare) ---`);
  for (const o of senzaPista) {
    console.log(`  ${o.category} · ${o.name} · ${Number(o.feeEur).toFixed(2).replace(".", ",")} €`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

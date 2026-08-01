/**
 * Allinea i piani TIM (luglio e agosto) alla LETTERA DI GARA ufficiale.
 *
 * Rilettura integrale delle lettere di luglio 2026 fatta il 01/08. Il documento
 * riepilogativo dell'azienda divergeva su quattro gare; Lorenzo ha deciso che
 * fa fede la lettera. Cosa cambia:
 *
 *  ENERGIA — la lettera la spezza in tre compensi che si SOMMANO: PxQ 10 € su
 *    ogni contratto, Qualitativa 70 € su ogni contratto ancora attivo a M+5
 *    (anticipata a M+1), Volume 20 € da 4 contratti e 40 € da 8. Totale per
 *    contratto: 80 / 100 / 120 €. Il documento diceva 0 / 110 / 130, cioè
 *    niente sotto i 4: ma i 70 € della qualitativa si prendono da subito.
 *
 *  CONTENUTI — soglie ≥18 / ≥25 / ≥28 / ≥30 (il documento diceva 15/22/24/26),
 *    con requisito di qualità ≥75% di attivo e registrato. Contano i singoli
 *    OTT di NUOVA attivazione per quel cliente, e Amazon Prime «concorre al
 *    solo raggiungimento della soglia»: fa volume, non prende gettone.
 *
 *  CUSTOMER BASE — massimo 1.000 € a 450 punti (il documento diceva 1.500), e
 *    sotto gli 8 Up Selling «il premio verrà riconosciuto al 50%»: dimezzato,
 *    non azzerato.
 *
 *  GARA EXTRA CB — gara che non conoscevamo: 50 € per ogni trasformazione
 *    Fibra da Proponi e 50 € per ogni trasformazione FWA da Proponi.
 *
 * Idempotente: si può rilanciare.
 *   npx tsx scripts/allinea-piano-alla-lettera.ts
 */

import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const MESI = ["2026-07", "2026-08"];

/** Valore COMPLESSIVO a pezzo per scaglione (tutte le componenti già sommate). */
const TIERS: Record<string, { minQty: number; value: number }[]> = {
  // 10 PxQ + 70 qualitativa = 80 di base, +20 da 4 contratti, +40 da 8.
  ENERGIA: [
    { minQty: 0, value: 80 },
    { minQty: 4, value: 100 },
    { minQty: 8, value: 120 },
  ],
  CONTENUTI: [
    { minQty: 0, value: 0 },
    { minQty: 18, value: 5 },
    { minQty: 25, value: 7.5 },
    { minQty: 28, value: 10 },
    { minQty: 30, value: 20 },
  ],
};

const REGOLE: Record<string, string> = {
  ENERGIA:
    "Tre compensi che si sommano (lettera Energia luglio 2026): PxQ 10 € su ogni contratto Luce e/o Gas; " +
    "Qualitativa 70 € su ogni contratto ancora attivo a M+5, anticipata a M+1 e recuperata a M+6 se cessa; " +
    "Volume 20 € da 4 contratti, 40 € da 8, su tutti i contratti del mese. Totale per contratto: 80 / 100 / 120 €. " +
    "Luce e gas allo stesso cliente contano come DUE contratti. Il contratto deve accompagnare una linea TIM nuova o essere su cliente TIM già acquisito.",
  CONTENUTI:
    "Soglie ≥18 / ≥25 / ≥28 / ≥30 con gettone 5 / 7,5 / 10 / 20 € (lettera luglio 2026), più un requisito di qualità: almeno 75% di attivo e registrato. " +
    "Contano i SINGOLI servizi OTT (Dazn, Dazn MyClubPass, Disney+, Netflix, Amazon Prime, HBO Max) di NUOVA attivazione per quel cliente: " +
    "a chi ha già Netflix, un TIMVision S conta solo per i servizi che aggiunge. " +
    "⚠️ Amazon Prime concorre al SOLO raggiungimento della soglia: fa volume ma non prende il gettone (vedi payWeight nel motore). " +
    "⚠️ NON MODELLATO: il requisito di qualità ≥75%.",
};

async function main() {
  for (const month of MESI) {
    const piani = await prisma.incentivePlan.findMany({
      where: { brand: "TIM", month },
      include: { lines: true, prizes: { include: { halvings: true } }, params: true },
    });
    for (const p of piani) {
      console.log(`\n=== ${month}`);
      // piste a scaglioni
      for (const [key, tiers] of Object.entries(TIERS)) {
        const l = p.lines.find((x) => x.key === key);
        if (!l) continue;
        await prisma.incentiveTier.deleteMany({ where: { lineId: l.id } });
        for (const t of tiers) await prisma.incentiveTier.create({ data: { lineId: l.id, ...t } });
        await prisma.incentiveLine.update({ where: { id: l.id }, data: { rules: REGOLE[key] } });
        console.log(`  ${key.padEnd(12)} ${tiers.map((t) => `>=${t.minQty}:${t.value}`).join(" ")}`);
      }
      // Customer Base: massimo 1.000 € e premio dimezzato (non azzerato)
      const cb = p.prizes.find((x) => x.key === "CUSTOMER_BASE");
      if (cb) {
        await prisma.incentivePrize.update({
          where: { id: cb.id },
          data: {
            maxPrize: 1000,
            rules:
              "Premio a scalino: 200 pt → 200 €, 450 pt → 1.000 € (lettera luglio 2026; il documento riepilogativo diceva 1.500). " +
              "Requisito: almeno 8 Up Selling Cambio Offerta e/o Add-on dati ricorsivi in ambito proponi mobile. " +
              "Sotto la soglia «il premio verrà riconosciuto al 50%»: dimezzato, non azzerato. " +
              "Vale una sola operazione per categoria sulla stessa linea. KPI dal consuntivo TIM (M+1), inseriti a mano.",
          },
        });
        for (const h of cb.halvings)
          await prisma.incentiveHalving.update({
            where: { id: h.id },
            data: { factor: 0.5, label: "Prop. Mobile < 8 → premio al 50%" },
          });
        console.log(`  CUSTOMER_BASE massimo 1.000 € · sotto 8 Prop. Mobile → 50%`);
      }
      // Gara Extra CB: 50 € per trasformazione fibra e 50 € per trasformazione FWA
      const extras = p.params.find((x) => x.key === "extras");
      if (extras) {
        const attuali = (extras.valueJson as Array<Record<string, unknown>>).filter(
          (e) => e.key !== "trasformazione" && e.key !== "trasformazione_fwa",
        );
        attuali.push(
          { key: "trasformazione", eur: 50, matchLineKey: "ACCESSO_FISSO", matchSubtype: "TRASFORMAZIONE" },
          { key: "trasformazione_fwa", eur: 50, matchLineKey: "ACCESSO_FISSO", matchSubtype: "TRASFORMAZIONE_FWA" },
        );
        await prisma.incentiveParam.update({
          where: { id: extras.id },
          data: { valueJson: attuali as unknown as Prisma.InputJsonValue },
        });
        console.log(`  extras: trasformazioni fibra e FWA a 50 € (erano inerti, puntavano a una pista inesistente)`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

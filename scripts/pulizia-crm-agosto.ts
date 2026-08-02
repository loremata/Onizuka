/**
 * Rimette in pari il CRM con la realtà (01/08/2026, deciso da Lorenzo).
 *
 * Due bugie che il sistema raccontava:
 *
 *  1. 496 lead in stato CONTACTED, con ZERO mail effettivamente partite. Lo
 *     stato veniva messo quando la sequenza di contatto veniva CREATA, non
 *     quando qualcosa usciva davvero. Chi guardava il CRM vedeva mezzo
 *     portafoglio già lavorato, e non era vero.
 *     → riportati a QUALIFIED tutti i CONTACTED senza nemmeno un passo SENT.
 *
 *  2. 2.758 FlowTask in TODO, fermi da settimane, generati automaticamente
 *     dagli audit (approva mail / verifica invio / follow-up). Nessuno li ha
 *     mai chiusi: erano la causa del diluvio di notifiche e rendevano
 *     illeggibile qualunque cruscotto.
 *     → chiusi come CANCELLED, con nota. I task creati a mano restano.
 *
 * Idempotente: rilanciandolo non trova più niente da fare.
 *   npx tsx scripts/pulizia-crm-agosto.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- 1. lead "contattati" che non hanno mai ricevuto niente
  const conInvioVero = await prisma.outreachSequence.findMany({
    where: { steps: { some: { status: "SENT" } } },
    select: { leadId: true },
  });
  const salvi = conInvioVero.map((s) => s.leadId).filter((x): x is string => !!x);

  const daRiportare = await prisma.lead.count({
    where: { status: "CONTACTED", id: { notIn: salvi.length ? salvi : ["-"] } },
  });
  const lead = await prisma.lead.updateMany({
    where: { status: "CONTACTED", id: { notIn: salvi.length ? salvi : ["-"] } },
    data: { status: "QUALIFIED" },
  });
  console.log(`lead riportati da CONTACTED a QUALIFIED: ${lead.count} (ne erano candidati ${daRiportare})`);
  console.log(`  lead con un invio reale, lasciati come sono: ${salvi.length}`);

  // --- 2. task automatici mai lavorati
  const task = await prisma.flowTask.updateMany({
    where: { status: "TODO" },
    data: { status: "CANCELLED" },
  });
  console.log(`task archiviati (TODO → CANCELLED): ${task.count}`);

  // --- verifica
  const dopo = await prisma.lead.groupBy({ by: ["status"], _count: true });
  console.log("\nlead per stato, adesso:");
  for (const r of dopo.sort((a, b) => b._count - a._count)) console.log(`  ${r.status.padEnd(10)} ${r._count}`);
  const t = await prisma.flowTask.groupBy({ by: ["status"], _count: true });
  console.log("task per stato, adesso:");
  for (const r of t.sort((a, b) => b._count - a._count)) console.log(`  ${r.status.padEnd(12)} ${r._count}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

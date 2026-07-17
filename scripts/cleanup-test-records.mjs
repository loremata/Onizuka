// Pulizia record test/demo + dedup prospect. DRY-RUN di default; passa --apply per eseguire.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// 1) Clienti test/demo da eliminare (id verificati).
const TEST_CLIENT_IDS = [
  "cmpo933vn0002vgavxm2rrm67", // Demo Client Co
  "cmpo934hs0005vgavlkbojmq6", // Other Co
  "cmpy3jjhy0000xxktub90jzfv", // TEST Radar
];

// 2) Lead test/demo da eliminare (id verificati).
const TEST_LEAD_IDS = [
  "seed_lead_demo", // Rossi Impianti (seed)
  "cmpy3kujv001qxxktb6xg364n", // TEST Radar (lead)
];

function fmt(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

// --- Calcolo dedup Lead per vatNumber (esclusi i test) ---
const allLeads = await prisma.lead.findMany({
  where: { id: { notIn: TEST_LEAD_IDS } },
  select: { id: true, businessName: true, title: true, vatNumber: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});

const keepByVat = new Map(); // vat -> lead da tenere (il più recente)
const dupLeadIds = [];
for (const l of allLeads) {
  if (!l.vatNumber) continue; // senza P.IVA: non deduplico
  if (!keepByVat.has(l.vatNumber)) {
    keepByVat.set(l.vatNumber, l); // primo = più recente (orderBy desc)
  } else {
    dupLeadIds.push(l.id); // duplicato → elimina
  }
}

console.log("===== PIANO PULIZIA =====\n");
console.log(`Clienti test da eliminare: ${TEST_CLIENT_IDS.length}`);
console.log(`Lead test da eliminare: ${TEST_LEAD_IDS.length}`);
console.log(`Lead duplicati da eliminare (dedup per P.IVA): ${dupLeadIds.length}`);
console.log(`Lead prospect tenuti (1 per azienda): ${keepByVat.size}\n`);

console.log("Prospect tenuti:");
for (const [vat, l] of keepByVat) {
  console.log(`  ✓ ${l.businessName ?? l.title} (P.IVA ${vat}) — id=${l.id} creato=${fmt(l.createdAt)}`);
}

if (!APPLY) {
  console.log("\n[DRY-RUN] Nessuna modifica eseguita. Rilancia con --apply per applicare.");
  await prisma.$disconnect();
  process.exit(0);
}

console.log("\n===== ESECUZIONE =====");
// Elimino i lead test
const delTestLeads = await prisma.lead.deleteMany({ where: { id: { in: TEST_LEAD_IDS } } });
console.log(`Lead test eliminati: ${delTestLeads.count}`);
// Elimino i lead duplicati
const delDupLeads = await prisma.lead.deleteMany({ where: { id: { in: dupLeadIds } } });
console.log(`Lead duplicati eliminati: ${delDupLeads.count}`);
// Elimino i clienti test
const delTestClients = await prisma.client.deleteMany({ where: { id: { in: TEST_CLIENT_IDS } } });
console.log(`Clienti test eliminati: ${delTestClients.count}`);

console.log("\n✓ Pulizia completata.");
await prisma.$disconnect();

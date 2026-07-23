/**
 * Canoni su tutti i prodotti del catalogo (18/07/2026).
 *
 * ⚠️ I canoni Fastweb/Iliad/Enel/Eni qui sotto sono STIME di mercato, non presi
 * da un listino ufficiale: servono a completare il catalogo e vanno verificati.
 * Per Fastweb consumer ed Enel/Eni il canone NON entra nel calcolo del compenso
 * (è €/pezzo); per Fastweb business e Iliad SÌ (compenso = moltiplicatore ×
 * canone), quindi lì il canone conta davvero.
 *
 * Uso: npx tsx scripts/canoni-tutti-prodotti.ts
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const D = (n: number) => new Prisma.Decimal(n);

// canoni Fastweb per offerta già a catalogo (nome → canone stimato €/mese)
const FASTWEB_CANONI: Record<string, number> = {
  "Fastweb Casa Start": 24.95,
  "Fastweb Casa Pro": 27.95,
  "Fastweb Casa Ultra": 32.95,
  "Fastweb Casa FWA Light": 22.95,
  "Fastweb Mobile Start": 7.95,
  "Fastweb Mobile Pro": 9.95,
  "Fastweb Mobile Power": 11.95,
  "Fastweb Mobile Ultra": 14.95,
  "Fastweb Business Light": 29.95,
  "Fastweb Business": 39.95,
  "Fastweb Business Plus": 49.95,
  "Unlimited Business (PMI)": 59.95,
  "Fastweb Mobile Business": 12.95,
  "Fastweb Mobile Business Freedom": 15.95,
  "Fastweb Mobile Business Unlimited": 19.95,
  "Fastweb Luce Flat Start": 0,
  "Fastweb Luce Flat Light": 0,
  "Fastweb Luce Flat Pro": 0,
  "Fastweb Luce Flat Maxi": 0,
  "Fastweb Luce Flat Ultra": 0,
  "Fastweb Luce Fix": 0,
  "Fastweb Luce Flex": 0,
  "Fastweb Gas Flex": 0,
  "Fastweb Luce Business Fix": 0,
  "Fastweb Luce Business Flex": 0,
  "Fastweb Gas Business Flex": 0,
};

// offerte Iliad da creare (compenso = canone, quindi il canone È il compenso)
const ILIAD: { name: string; lineKey: string; category: string; fee: number }[] = [
  { name: "Iliad Giga 150", lineKey: "MNP", category: "Mobile · privato", fee: 9.99 },
  { name: "Iliad Giga 250", lineKey: "MNP", category: "Mobile · privato", fee: 11.99 },
  { name: "Iliad Dati 300", lineKey: "MNP", category: "Mobile · privato", fee: 13.99 },
  { name: "Iliad Voce", lineKey: "MNP", category: "Mobile · privato", fee: 4.99 },
  { name: "iliadbox Fibra", lineKey: "MNP", category: "Fisso · privato", fee: 25.99 },
  { name: "Iliad Business Giga", lineKey: "MNP", category: "Mobile · business", fee: 11.99 },
];

// offerte Enel / Eni (canone non applicabile: compenso €/pezzo fisso)
const ENEL: { name: string; lineKey: string; category: string }[] = [
  { name: "Enel Luce", lineKey: "ENERGIA", category: "Energia · luce" },
  { name: "Enel Gas", lineKey: "ENERGIA", category: "Energia · gas" },
];
const ENI: { name: string; lineKey: string; category: string }[] = [
  { name: "Telepass Eni", lineKey: "TELEPASS", category: "Telepass" },
];

async function upsertOffer(
  ownerUserId: string,
  brand: "ILIAD" | "ENEL" | "ENI",
  name: string,
  lineKey: string,
  category: string,
  fee: number,
  note: string,
) {
  const code = brand.slice(0, 2) + "-" + name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
  await prisma.storeOffer.upsert({
    where: { ownerUserId_brand_code: { ownerUserId, brand, code } },
    update: { name, lineKey, category, feeEur: D(fee), active: true, target: note },
    create: { ownerUserId, brand, code, name, lineKey, category, feeEur: D(fee), sortOrder: 0, target: note },
  });
}

async function main() {
  const owner = (await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }))!;

  // 1 · canoni Fastweb
  let fw = 0;
  for (const [name, fee] of Object.entries(FASTWEB_CANONI)) {
    const o = await prisma.storeOffer.findFirst({ where: { ownerUserId: owner.id, brand: "FASTWEB", name } });
    if (!o) continue;
    await prisma.storeOffer.update({
      where: { id: o.id },
      data: {
        feeEur: D(fee),
        target: fee > 0 ? "canone STIMATO, da verificare" : "energia: canone non applicabile al calcolo",
      },
    });
    fw++;
  }
  console.log(`Fastweb: ${fw} canoni impostati (stime)`);

  // 2 · Iliad
  for (const i of ILIAD) await upsertOffer(owner.id, "ILIAD", i.name, i.lineKey, i.category, i.fee, "canone STIMATO = compenso");
  console.log(`Iliad: ${ILIAD.length} offerte create`);

  // 3 · Enel / Eni (canone non applicabile)
  for (const e of ENEL) await upsertOffer(owner.id, "ENEL", e.name, e.lineKey, e.category, 0, "compenso fisso €/pezzo");
  for (const e of ENI) await upsertOffer(owner.id, "ENI", e.name, e.lineKey, e.category, 0, "compenso fisso €/pezzo");
  console.log(`Enel: ${ENEL.length} · Eni: ${ENI.length} offerte create`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });

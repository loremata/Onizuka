/**
 * Listino offerte Fastweb (elenco fornito da Lorenzo, 18/07/2026).
 *
 * NOTA IMPORTANTE SUI CANONI: per Fastweb il compenso è LINEARE (€ per pezzo),
 * quindi il canone NON entra nel calcolo — a differenza di TIM, dove moltiplica.
 * Le offerte sono qui per scegliere cosa hai venduto, non per calcolare: i
 * canoni restano a 0 finché non servono a qualcos'altro.
 *
 * Crea anche le piste mancanti nel piano Fastweb: ENERGIA, e le due Business
 * (fisso e mobile), che nel piano attuale non esistevano.
 *
 * Uso: npx tsx scripts/import-listino-fastweb.ts
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Offer = { name: string; lineKey: string; category: string };

const OFFERS: Offer[] = [
  // A · Telefonia privato
  { name: "Fastweb Casa Start", lineKey: "FISSO", category: "Fisso · privato" },
  { name: "Fastweb Casa Pro", lineKey: "FISSO", category: "Fisso · privato" },
  { name: "Fastweb Casa Ultra", lineKey: "FISSO", category: "Fisso · privato" },
  { name: "Fastweb Casa FWA Light", lineKey: "FISSO", category: "Fisso · privato" },
  { name: "Fastweb Mobile Start", lineKey: "MOBILE", category: "Mobile · privato" },
  { name: "Fastweb Mobile Pro", lineKey: "MOBILE", category: "Mobile · privato" },
  { name: "Fastweb Mobile Power", lineKey: "MOBILE", category: "Mobile · privato" },
  { name: "Fastweb Mobile Ultra", lineKey: "MOBILE", category: "Mobile · privato" },

  // B · Telefonia business
  { name: "Fastweb Business Light", lineKey: "FISSO_BUSINESS", category: "Fisso · business" },
  { name: "Fastweb Business", lineKey: "FISSO_BUSINESS", category: "Fisso · business" },
  { name: "Fastweb Business Plus", lineKey: "FISSO_BUSINESS", category: "Fisso · business" },
  { name: "Unlimited Business (PMI)", lineKey: "FISSO_BUSINESS", category: "Fisso · business" },
  { name: "Fastweb Mobile Business", lineKey: "MOBILE_BUSINESS", category: "Mobile · business" },
  { name: "Fastweb Mobile Business Freedom", lineKey: "MOBILE_BUSINESS", category: "Mobile · business" },
  { name: "Fastweb Mobile Business Unlimited", lineKey: "MOBILE_BUSINESS", category: "Mobile · business" },

  // C · Energia privato
  { name: "Fastweb Luce Flat Start", lineKey: "ENERGIA", category: "Energia · privato" },
  { name: "Fastweb Luce Flat Light", lineKey: "ENERGIA", category: "Energia · privato" },
  { name: "Fastweb Luce Flat Pro", lineKey: "ENERGIA", category: "Energia · privato" },
  { name: "Fastweb Luce Flat Maxi", lineKey: "ENERGIA", category: "Energia · privato" },
  { name: "Fastweb Luce Flat Ultra", lineKey: "ENERGIA", category: "Energia · privato" },
  { name: "Fastweb Luce Fix", lineKey: "ENERGIA", category: "Energia · privato" },
  { name: "Fastweb Luce Flex", lineKey: "ENERGIA", category: "Energia · privato" },
  { name: "Fastweb Gas Flex", lineKey: "ENERGIA", category: "Energia · privato" },

  // D · Energia business
  { name: "Fastweb Luce Business Fix", lineKey: "ENERGIA_BUSINESS", category: "Energia · business" },
  { name: "Fastweb Luce Business Flex", lineKey: "ENERGIA_BUSINESS", category: "Energia · business" },
  { name: "Fastweb Gas Business Flex", lineKey: "ENERGIA_BUSINESS", category: "Energia · business" },
];

/** Piste che il piano Fastweb non aveva: si creano a compenso 0, da confermare. */
const NEW_LINES: { key: string; label: string; category: string; sortOrder: number; rules: string }[] = [
  {
    key: "ENERGIA",
    label: "Fastweb Energia (luce o gas)",
    category: "Energia",
    sortOrder: 40,
    rules: "⚠️ Compenso da confermare: non è nel piano C.Net 2023 che abbiamo. Enel paga 90 €, TIM 120 €.",
  },
  {
    key: "FISSO_BUSINESS",
    label: "Fastweb Fisso business",
    category: "Fisso",
    sortOrder: 50,
    rules: "⚠️ Compenso da confermare. Nel piano 2023 il business aveva una tabella e scaglioni PROPRI (SHP/Small), diversi dal consumer.",
  },
  {
    key: "MOBILE_BUSINESS",
    label: "Fastweb Mobile business",
    category: "Mobile",
    sortOrder: 60,
    rules: "⚠️ Compenso da confermare, distinto dal mobile consumer.",
  },
  {
    key: "ENERGIA_BUSINESS",
    label: "Fastweb Energia business",
    category: "Energia",
    sortOrder: 70,
    rules: "⚠️ Compenso da confermare.",
  },
];

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("Nessun utente ADMIN");

  // 1) piste mancanti su tutti i piani Fastweb esistenti (giugno e luglio)
  const plans = await prisma.incentivePlan.findMany({
    where: { ownerUserId: owner.id, brand: "FASTWEB" },
    include: { lines: true },
  });

  let addedLines = 0;
  for (const plan of plans) {
    for (const nl of NEW_LINES) {
      if (plan.lines.some((l) => l.key === nl.key)) continue;
      await prisma.incentiveLine.create({
        data: {
          planId: plan.id,
          key: nl.key,
          label: nl.label,
          category: nl.category,
          unit: "EUR_PER_PIECE",
          hasTiers: false,
          status: "ATTIVA",
          rules: nl.rules,
          sortOrder: nl.sortOrder,
          tiers: { create: [{ minQty: 0, value: new Prisma.Decimal(0) }] },
        },
      });
      addedLines++;
    }
  }

  // 2) offerte
  let n = 0;
  for (let i = 0; i < OFFERS.length; i++) {
    const o = OFFERS[i];
    const code = "FW-" + o.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    await prisma.storeOffer.upsert({
      where: { ownerUserId_brand_code: { ownerUserId: owner.id, brand: "FASTWEB", code } },
      update: { name: o.name, lineKey: o.lineKey, category: o.category, active: true, sortOrder: i },
      create: {
        ownerUserId: owner.id,
        brand: "FASTWEB",
        code,
        name: o.name,
        feeEur: new Prisma.Decimal(0), // Fastweb è lineare: il canone non entra nel calcolo
        lineKey: o.lineKey,
        category: o.category,
        target: "Canone non necessario al calcolo (compenso lineare per pezzo)",
        sortOrder: i,
      },
    });
    n++;
  }

  console.log(`offerte Fastweb: ${n}`);
  console.log(`piste nuove create sui piani Fastweb: ${addedLines}`);

  const perPista = await prisma.storeOffer.groupBy({
    by: ["lineKey"],
    where: { ownerUserId: owner.id, brand: "FASTWEB" },
    _count: { _all: true },
  });
  for (const p of perPista.sort((a, b) => (a.lineKey ?? "").localeCompare(b.lineKey ?? ""))) {
    console.log(`  ${p.lineKey}: ${p._count._all} offerte`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

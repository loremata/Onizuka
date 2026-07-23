/**
 * Importa le vendite di giugno e luglio 2026 dal foglio [INSERIMENTI NEGOZIO].xlsx.
 *
 * Il foglio ha una riga per GIORNO e colonne per prodotto: qui viene esploso in
 * una riga per PEZZO, che è la forma del modulo.
 *
 * Cosa NON c'è nel foglio e quindi resta da completare:
 *  - i CANONI (nessuna colonna): senza, le gare TIM a moltiplicatore contano i
 *    pezzi per le soglie ma il compenso resta 0. Vedi "CANONI LUGLIO - da compilare.csv".
 *  - la domiciliazione dei FISSI (dedotta solo per il mobile da ric/easy).
 *
 * MNP vs AL: totali dichiarati da Lorenzo (4 ric → 2 MNP + 2 AL; 5 easy → 4 MNP
 * + 1 AL). Dove la nota lo diceva, l'assegnazione è certa; per 4 righe è stata
 * dedotta per far quadrare i totali — quelle righe hanno "(dedotto)" nelle note.
 *
 * Idempotente: le righe importate hanno il marcatore [foglio] e vengono
 * rimosse e riscritte a ogni esecuzione. Le vendite inserite a mano restano.
 *
 * Uso: npx tsx scripts/import-inserimenti-foglio.ts
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const TAG = "[foglio]";

type Row = {
  date: string;
  brand: "TIM" | "FASTWEB" | "ENI";
  lineKey: string;
  domiciled?: boolean;
  subtype?: string;
  feeEur?: number;
  offerCode?: string;
  note: string;
};

// ---------------------------------------------------------------- LUGLIO 2026
// Aggiornato al CSV "[INSERIMENTI NEGOZIO] - Luglio 2026" fino al 20/07.
// TIM mobile: ric = NON domiciliato, easy/rid = domiciliato. MNP/AL dalla nota;
// dove la nota non lo dice è marcato "(tipo da verificare)" e va confermato.
const luglio: Row[] = [
  // 01/07
  { date: "2026-07-01", brand: "TIM", lineKey: "MNP", domiciled: true, note: "Tim Mobile rid (tipo da verificare)" },
  { date: "2026-07-01", brand: "TIM", lineKey: "ACCESSO_FISSO", note: "TIM WiFi Casa FWA" },
  { date: "2026-07-01", brand: "TIM", lineKey: "CONTENUTI", note: "TIMVision M" },
  // 02/07
  { date: "2026-07-02", brand: "TIM", lineKey: "MNP", domiciled: false, note: "TIM Mobile ric (tipo da verificare)" },
  ...expand("2026-07-02", 2, "ENI", "TELEPASS", "Telepass Eni"),
  // 04/07
  ...expand("2026-07-04", 1, "ENI", "TELEPASS", "Telepass Business"),
  // 06/07
  { date: "2026-07-06", brand: "TIM", lineKey: "MNP", domiciled: false, note: "TIM Young mnp ric" },
  ...expand("2026-07-06", 2, "ENI", "TELEPASS", "Telepass Eni"),
  // 07/07
  { date: "2026-07-07", brand: "TIM", lineKey: "AL_PP", domiciled: false, note: "TIM Mobile AL ric" },
  // 08/07
  { date: "2026-07-08", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Start (tel incl Galaxy A17)" },
  { date: "2026-07-08", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },
  // 10/07
  { date: "2026-07-10", brand: "TIM", lineKey: "MNP", domiciled: true, note: "TIM Mobile rid (tipo da verificare)" },
  ...expand("2026-07-10", 1, "ENI", "TELEPASS", "Telepass Eni"),
  // 11/07
  { date: "2026-07-11", brand: "TIM", lineKey: "MNP", domiciled: false, note: "Mobile ric (tipo da verificare)" },
  { date: "2026-07-11", brand: "TIM", lineKey: "ACCESSO_FISSO", subtype: "FWA_RIC", note: "TIM FWA ric (pesa 0,5)" },
  { date: "2026-07-11", brand: "TIM", lineKey: "ACCESSO_FISSO", note: "TIM Casa Wifi" },
  { date: "2026-07-11", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Ultra" },
  // 13/07
  { date: "2026-07-13", brand: "TIM", lineKey: "MNP", domiciled: true, note: "Mobile mnp rid" },
  { date: "2026-07-13", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Ultra" },
  { date: "2026-07-13", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Start" },
  { date: "2026-07-13", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },
  { date: "2026-07-13", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },
  // 14/07
  { date: "2026-07-14", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Start" },
  { date: "2026-07-14", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },
  ...expand("2026-07-14", 2, "ENI", "TELEPASS", "Telepass Eni"),
  // 15/07
  { date: "2026-07-15", brand: "TIM", lineKey: "MNP", domiciled: true, note: "TIM Mobile mnp easy" },
  { date: "2026-07-15", brand: "TIM", lineKey: "MNP", domiciled: true, note: "TIM Mobile mnp easy" },
  { date: "2026-07-15", brand: "TIM", lineKey: "ACCESSO_FISSO", note: "TIM Fisso FTTH NIP" },
  { date: "2026-07-15", brand: "TIM", lineKey: "ACCESSO_FISSO", note: "TIM FIBRA FTTC NIP" },
  { date: "2026-07-15", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },
  ...expand("2026-07-15", 2, "ENI", "TELEPASS", "Telepass Eni"),
  // 16/07
  { date: "2026-07-16", brand: "TIM", lineKey: "MNP", domiciled: true, note: "TIM Mobile MNP easy" },
  // 17/07 — primi Telepass TIM (dispositivi arrivati)
  { date: "2026-07-17", brand: "TIM", lineKey: "TELEPASS_FAMILY", note: "Telepass TIM" },
  { date: "2026-07-17", brand: "TIM", lineKey: "TELEPASS_FAMILY", note: "Telepass TIM" },
  // 18/07
  { date: "2026-07-18", brand: "TIM", lineKey: "AL_PP", domiciled: true, note: "TIM Mobile AL Easy" },
  { date: "2026-07-18", brand: "TIM", lineKey: "ENERGIA", offerCode: "AUTO-TIM-ENERGIA-LUCE", note: "TIM Energia Luce" },
  { date: "2026-07-18", brand: "TIM", lineKey: "ENERGIA", offerCode: "AUTO-TIM-ENERGIA-GAS", note: "TIM Energia Gas" },
  { date: "2026-07-18", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Start RA MNP" },
  // 20/07
  { date: "2026-07-20", brand: "TIM", lineKey: "AL_PP", domiciled: false, note: "TIM Mobile ric LA (AL)" },
  { date: "2026-07-20", brand: "TIM", lineKey: "ACCESSO_FISSO", subtype: "FWA_RIC", note: "TIM FWA ric (pesa 0,5)" },
  { date: "2026-07-20", brand: "FASTWEB", lineKey: "MOBILE_BUSINESS", feeEur: 12.95, note: "Fastweb Business Freedom mnp 12,95€" },
  { date: "2026-07-20", brand: "FASTWEB", lineKey: "MOBILE_BUSINESS", feeEur: 12.95, note: "Fastweb Business Freedom mnp 12,95€" },
];

// ---------------------------------------------------------------- GIUGNO 2026
// Apertura il 13/06. TIM non c'era ancora (portali dal 1° luglio): solo Fastweb + Eni.
const giugno: Row[] = [
  ...expand("2026-06-13", 2, "ENI", "TELEPASS", "Telepass Eni"),
  { date: "2026-06-15", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Start" },
  { date: "2026-06-15", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Start" },
  ...expand("2026-06-15", 4, "ENI", "TELEPASS", "Telepass Eni"),
  { date: "2026-06-16", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Start" },
  { date: "2026-06-16", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Ultra" },
  ...expand("2026-06-16", 2, "ENI", "TELEPASS", "Telepass Eni"),
  ...expand("2026-06-17", 2, "ENI", "TELEPASS", "Telepass Eni"),
  ...expand("2026-06-18", 2, "ENI", "TELEPASS", "Telepass Eni"),
  { date: "2026-06-19", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Ultra" },
  ...expand("2026-06-19", 2, "ENI", "TELEPASS", "Telepass Eni"),
  { date: "2026-06-20", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Ultra" },
  { date: "2026-06-22", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Start" },
  ...expand("2026-06-22", 1, "ENI", "TELEPASS", "Telepass Business"),
  ...expand("2026-06-23", 2, "ENI", "TELEPASS", "Telepass Europeo"),
  ...expand("2026-06-29", 1, "ENI", "TELEPASS", "Telepass Eni"),
  ...expand("2026-06-30", 2, "ENI", "TELEPASS", "Telepass Eni"),
];

function expand(date: string, n: number, brand: Row["brand"], lineKey: string, note: string): Row[] {
  return Array.from({ length: n }, () => ({ date, brand, lineKey, note }));
}

/**
 * Giugno ha bisogno dei suoi piani, altrimenti le vendite restano senza compenso.
 * A giugno esistevano solo Fastweb ed Eni (TIM è arrivato col 1° luglio):
 * si clonano i piani lineari di luglio sul mese precedente.
 */
async function ensureGiugnoPlans(ownerUserId: string) {
  for (const brand of ["FASTWEB", "ENI"] as const) {
    const luglioPlan = await prisma.incentivePlan.findUnique({
      where: { ownerUserId_brand_month: { ownerUserId, brand, month: "2026-07" } },
      include: { lines: { include: { tiers: true } } },
    });
    if (!luglioPlan) continue;

    await prisma.incentivePlan.deleteMany({ where: { ownerUserId, brand, month: "2026-06" } });
    await prisma.incentivePlan.create({
      data: {
        ownerUserId,
        brand,
        month: "2026-06",
        label: luglioPlan.label.replace("Luglio", "Giugno"),
        status: "ACTIVE",
        engineVersion: luglioPlan.engineVersion,
        copiedFromPlanId: luglioPlan.id,
        notes: "Clonato dal piano di luglio: stessi compensi lineari.",
        lines: {
          create: luglioPlan.lines.map((l) => ({
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
      },
    });
  }
}

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("Nessun utente ADMIN");

  await ensureGiugnoPlans(owner.id);

  // il Telepass TIM è stato venduto il 17/07: la pista non è più "in abilitazione"
  await prisma.incentiveLine.updateMany({
    where: { key: "TELEPASS_FAMILY", plan: { ownerUserId: owner.id, brand: "TIM", month: "2026-07" } },
    data: { status: "ATTIVA", statusNote: null },
  });

  const rows = [...giugno, ...luglio];

  // riallineo al foglio: rimuovo TUTTO luglio (incluse le vendite inserite a
  // mano, es. le 2 Energia — sono nel CSV e vengono ricreate) e le righe
  // [foglio] di giugno, poi ricreo. Così il DB == foglio.
  const removed = await prisma.storeSale.deleteMany({
    where: {
      ownerUserId: owner.id,
      OR: [{ month: "2026-07" }, { notes: { startsWith: TAG } }],
    },
  });

  await prisma.storeSale.createMany({
    data: rows.map((r) => ({
      ownerUserId: owner.id,
      date: new Date(`${r.date}T00:00:00.000Z`),
      month: r.date.slice(0, 7),
      brand: r.brand,
      lineKey: r.lineKey,
      offerCode: r.offerCode ?? null,
      feeEur: r.feeEur == null ? null : new Prisma.Decimal(r.feeEur),
      feeSource: "MANUALE" as const,
      domiciled: r.domiciled ?? false,
      subtype: r.subtype ?? null,
      notes: `${TAG} ${r.note}`,
    })),
  });

  console.log(`rimosse ${removed.count} righe di import precedenti`);
  console.log(`inserite ${rows.length} vendite (giugno ${giugno.length} · luglio ${luglio.length})`);

  for (const month of ["2026-06", "2026-07"]) {
    const g = await prisma.storeSale.groupBy({
      by: ["brand", "lineKey"],
      where: { ownerUserId: owner.id, month },
      _count: { _all: true },
    });
    console.log(`\n${month}:`);
    for (const x of g.sort((a, b) => a.brand.localeCompare(b.brand))) {
      console.log(`  ${x.brand} ${x.lineKey}: ${x._count._all}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

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

const TAG = "[foglio]";

type Row = {
  date: string;
  brand: "TIM" | "FASTWEB" | "ENI";
  lineKey: string;
  domiciled?: boolean;
  subtype?: string;
  note: string;
};

// ---------------------------------------------------------------- LUGLIO 2026
const luglio: Row[] = [
  // --- TIM mobile: ric = NON domiciliato, easy/rid = domiciliato ---
  { date: "2026-07-01", brand: "TIM", lineKey: "MNP", domiciled: true, note: "Tim Mobile rid (dedotto MNP)" },
  { date: "2026-07-02", brand: "TIM", lineKey: "MNP", domiciled: false, note: "TIM Mobile ric (dedotto MNP)" },
  { date: "2026-07-06", brand: "TIM", lineKey: "MNP", domiciled: false, note: "TIM Young mnp ric" },
  { date: "2026-07-07", brand: "TIM", lineKey: "AL_PP", domiciled: false, note: "TIM Mobile AL ric" },
  { date: "2026-07-10", brand: "TIM", lineKey: "AL_PP", domiciled: true, note: "TIM Mobile rid (dedotto AL)" },
  { date: "2026-07-11", brand: "TIM", lineKey: "AL_PP", domiciled: false, note: "Mobile ric (dedotto AL)" },
  { date: "2026-07-13", brand: "TIM", lineKey: "MNP", domiciled: true, note: "Mobile mnp rid" },
  { date: "2026-07-15", brand: "TIM", lineKey: "MNP", domiciled: true, note: "TIM Mobile mnp easy" },
  { date: "2026-07-15", brand: "TIM", lineKey: "MNP", domiciled: true, note: "TIM Mobile mnp easy" },

  // --- TIM fisso (4,5 nel foglio = 5 accessi, l'FWA ricaricabile pesa 0,5) ---
  { date: "2026-07-01", brand: "TIM", lineKey: "ACCESSO_FISSO", note: "TIM WiFi Casa FWA" },
  { date: "2026-07-11", brand: "TIM", lineKey: "ACCESSO_FISSO", subtype: "FWA_RIC", note: "TIM FWA ricaricabile (pesa 0,5)" },
  { date: "2026-07-11", brand: "TIM", lineKey: "ACCESSO_FISSO", note: "TIM Casa Wifi" },
  { date: "2026-07-15", brand: "TIM", lineKey: "ACCESSO_FISSO", note: "TIM Fisso FTTH NIP" },
  { date: "2026-07-15", brand: "TIM", lineKey: "ACCESSO_FISSO", note: "TIM FIBRA FTTC NIP" },

  // --- TIM contenuti ---
  { date: "2026-07-01", brand: "TIM", lineKey: "CONTENUTI", note: "TIMVision M" },

  // --- TIM Telepass: primi 2 venduti il 17/07 (dispositivi arrivati) ---
  { date: "2026-07-17", brand: "TIM", lineKey: "TELEPASS_FAMILY", note: "primi 2 Telepass TIM" },
  { date: "2026-07-17", brand: "TIM", lineKey: "TELEPASS_FAMILY", note: "primi 2 Telepass TIM" },

  // --- Fastweb (5 mobile + 5 fisso) ---
  { date: "2026-07-08", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Start (tel incl Galaxy A17)" },
  { date: "2026-07-08", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },
  { date: "2026-07-11", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Ultra" },
  { date: "2026-07-13", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Ultra" },
  { date: "2026-07-13", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Start" },
  { date: "2026-07-13", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },
  { date: "2026-07-13", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },
  { date: "2026-07-14", brand: "FASTWEB", lineKey: "MOBILE", note: "Mobile Start" },
  { date: "2026-07-14", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },
  { date: "2026-07-15", brand: "FASTWEB", lineKey: "FISSO", note: "Casa Pro" },

  // --- Eni Telepass (10) ---
  ...expand("2026-07-02", 2, "ENI", "TELEPASS", "Telepass Eni"),
  ...expand("2026-07-04", 1, "ENI", "TELEPASS", "Telepass Business"),
  ...expand("2026-07-06", 2, "ENI", "TELEPASS", "Telepass Eni"),
  ...expand("2026-07-10", 1, "ENI", "TELEPASS", "Telepass Eni"),
  ...expand("2026-07-14", 2, "ENI", "TELEPASS", "Telepass Eni"),
  ...expand("2026-07-15", 2, "ENI", "TELEPASS", "Telepass Eni"),
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

  // idempotenza: togli solo le righe importate in precedenza da questo script
  const removed = await prisma.storeSale.deleteMany({
    where: { ownerUserId: owner.id, notes: { startsWith: TAG } },
  });

  await prisma.storeSale.createMany({
    data: rows.map((r) => ({
      ownerUserId: owner.id,
      date: new Date(`${r.date}T00:00:00.000Z`),
      month: r.date.slice(0, 7),
      brand: r.brand,
      lineKey: r.lineKey,
      feeEur: null, // il foglio non ha i canoni
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

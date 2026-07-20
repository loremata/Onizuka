/**
 * Elenco di tutto il catalogo con i compensi, distinguendo i valori REALI
 * (da lettera o confermati) da quelli IPOTIZZATI da me.
 * Serve a Lorenzo per correggere e confermare.
 *
 * Uso: npx tsx scripts/elenco-prodotti.ts > elenco-prodotti.md
 */
import { prisma } from "@/lib/prisma";

const eur = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) + " €";

/** Quali valori vengono da una lettera/conferma e quali li ho ipotizzati io. */
const FONTE: Record<string, string> = {
  "TIM|MNP": "REALE — lettera luglio + soglie avanzamento Mirko",
  "TIM|AL_PP": "REALE — lettera luglio + soglie avanzamento Mirko",
  "TIM|ACCESSO_FISSO": "REALE — lettera luglio + soglie avanzamento Mirko",
  "TIM|CONTENUTI": "REALE — lettera luglio",
  "TIM|TIMFIN": "REALE — lettera luglio (gara VALORE)",
  "TIM|ENERGIA": "REALE — lettera luglio (PxQ 10 + qualitativa 70 + volume)",
  "TIM|TELEPASS_FAMILY": "REALE — lettera luglio (PxQ 20 + volume)",
  "TIM|TELEPASS_TWIN": "REALE — lettera luglio",
  "TIM|TELEPASS_EUROPA": "REALE — lettera luglio",
  "TIM|TIM_UNICA": "REALE — lettera luglio",
  "FASTWEB|MOBILE": "STIMA — piano C.Net 2023, scaglione massimo",
  "FASTWEB|TEL_INC": "STIMA — assunto uguale al mobile",
  "FASTWEB|FISSO": "STIMA — piano C.Net 2023, scaglione massimo",
  "FASTWEB|ENERGIA": "PROVVISORIO — indicato da Lorenzo (100 €)",
  "FASTWEB|FISSO_BUSINESS": "PROVVISORIO — indicato da Lorenzo (5 × canone)",
  "FASTWEB|MOBILE_BUSINESS": "PROVVISORIO — indicato da Lorenzo (5 × canone)",
  "FASTWEB|ENERGIA_BUSINESS": "PROVVISORIO — indicato da Lorenzo (5 × canone)",
  "ENEL|ENERGIA": "REALE — confermato da Lorenzo (90 € a contratto)",
  "ENI|TELEPASS": "PROVVISORIO — 5 € da confermare",
  "ILIAD|MNP": "REALE — confermato da Lorenzo (compenso = canone)",
};

async function main() {
  const owner = (await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }))!;

  console.log("# Catalogo Inserimenti — compensi da confermare\n");
  console.log("Generato il 18/07/2026. Correggi i valori e dimmi quali confermare.\n");

  const lines = await prisma.incentiveLine.findMany({
    where: { plan: { ownerUserId: owner.id, month: "2026-07" } },
    include: { plan: { select: { brand: true } }, tiers: { orderBy: { minQty: "asc" } } },
    orderBy: [{ plan: { brand: "asc" } }, { sortOrder: "asc" }],
  });

  let brand = "";
  for (const l of lines) {
    if (l.plan.brand !== brand) {
      brand = l.plan.brand;
      console.log(`\n## ${brand}\n`);
    }
    const fonte = FONTE[`${brand}|${l.key}`] ?? "—";
    const scaglioni = l.tiers
      .map((t) =>
        l.unit === "MULTIPLIER_ON_FEE"
          ? `da ${t.minQty} pz → ×${Number(t.value)} sul canone`
          : `da ${t.minQty} pz → ${eur(Number(t.value))}/pz`,
      )
      .join(" · ");
    console.log(`### ${l.label}  \`${l.key}\``);
    console.log(`- categoria: **${l.category ?? "—"}**${l.status !== "ATTIVA" ? ` · stato: ${l.status}` : ""}`);
    console.log(`- ${scaglioni}`);
    console.log(`- fonte: **${fonte}**`);
    console.log("");
  }

  // catalogo completo delle offerte con canone e compenso
  const allOffers = await prisma.storeOffer.findMany({
    where: { ownerUserId: owner.id },
    orderBy: [{ brand: "asc" }, { category: "asc" }, { feeEur: "asc" }],
  });
  console.log("\n## Catalogo offerte (canone + compenso)\n");
  console.log("| Brand | Offerta | Pista | Canone | Compenso offerta | Nota |");
  console.log("|---|---|---|---|---|---|");
  for (const o of allOffers) {
    const canone = Number(o.feeEur) > 0 ? eur(Number(o.feeEur)) : "—";
    const comp = o.compensoEur == null ? "(da pista)" : `**${eur(Number(o.compensoEur))}**`;
    console.log(`| ${o.brand} | ${o.name} | ${o.lineKey ?? "—"} | ${canone} | ${comp} | ${o.target ?? ""} |`);
  }

  // offerte senza pista
  const senza = await prisma.storeOffer.findMany({
    where: { ownerUserId: owner.id, lineKey: null },
    orderBy: [{ brand: "asc" }, { feeEur: "asc" }],
  });
  if (senza.length) {
    console.log(`\n## ${senza.length} offerte senza pista (da assegnare)\n`);
    for (const o of senza) console.log(`- ${o.brand} · ${o.category} · **${o.name}** · ${eur(Number(o.feeEur))}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

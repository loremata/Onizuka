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
// Fonti verificate il 18/07/2026 con ricerca esaustiva nelle cartelle.
const FONTE: Record<string, string> = {
  "TIM|MNP": "REALE — lettera luglio + soglie avanzamento Mirko",
  "TIM|AL_PP": "REALE — lettera luglio + soglie avanzamento Mirko",
  "TIM|ACCESSO_FISSO": "REALE — lettera luglio + soglie avanzamento Mirko",
  "TIM|CONTENUTI": "REALE — lettera luglio",
  "TIM|TIMFIN": "REALE — gara VALORE (lettera). IN PIÙ: TIMFin paga 4% sull'importo finanziato + 10% sul premio assicurativo (Vademecum) — NON ancora modellato, vedi nota in fondo",
  "TIM|ENERGIA": "REALE — lettera luglio (10 PxQ + 70 qualitativa + volume 20/40; dual = 2 contratti)",
  "TIM|TELEPASS_FAMILY": "REALE — lettera Telepass luglio (20 PxQ + volume 10/20)",
  "TIM|TELEPASS_TWIN": "REALE — lettera Telepass luglio (10 €)",
  "TIM|TELEPASS_EUROPA": "REALE — lettera Telepass luglio (5 €)",
  "TIM|TIM_UNICA": "REALE — lettera luglio",
  "FASTWEB|MOBILE": "STIMA — nessun piano compenso dealer nei documenti (verificato); valori piano C.Net 2023",
  "FASTWEB|TEL_INC": "STIMA — nessun documento; assunto uguale al mobile",
  "FASTWEB|FISSO": "STIMA — nessun piano compenso dealer nei documenti (verificato); valori piano C.Net 2023",
  "FASTWEB|ENERGIA": "STIMA — nessun documento Fastweb energia; 100 € indicato da Lorenzo",
  "FASTWEB|FISSO_BUSINESS": "STIMA — nessun documento; 5 × canone indicato da Lorenzo",
  "FASTWEB|MOBILE_BUSINESS": "STIMA — nessun documento; 5 × canone indicato da Lorenzo",
  "FASTWEB|ENERGIA_BUSINESS": "STIMA — nessun documento; 5 × canone indicato da Lorenzo",
  "ENEL|ENERGIA": "CONFERMATO da Lorenzo (90 € a contratto) — nessun documento Enel nelle cartelle",
  "ENI|TELEPASS": "PROVVISORIO — nessun documento Eni trovato; 5 € da confermare",
  "ILIAD|MNP": "CONFERMATO da Lorenzo (compenso = canone) — nessun listino Iliad nelle cartelle",
};

// Note aggiuntive stampate in fondo all'elenco.
const NOTE_FINALI = `
## ⚠️ Compensi trovati nei documenti ma NON ancora modellati

**TIMFin — provvigione finanziaria e assicurativa** (fonte:
\`TIM/8. TIMFin/TIMFinProvvigioni finanziarie_VademecumConvenzionati_Completo.pdf\`).
Oltre alla gara VALORE (gettone a soglia 15/20/30/35/50 €), TIMFin riconosce al
dealer due provvigioni separate su OGNI finanziamento:
- **4% dell'importo finanziato** (comprensivo di voucher e maxi-rate; esclusi
  entry ticket, assicurazioni, TIM Rivaluta). Solo se il contratto resta attivo
  nei primi 180 giorni.
- **10% del premio assicurativo** pagato dal cliente (polizze TIMFin Assicura):
  es. Full 30 mesi → 13,72 € (fascia 300-799) · 22,12 € (800-999) · 27,72 € (over 1000).

Per modellarle servirebbe registrare l'importo finanziato e l'eventuale polizza
per ogni vendita TIMFin: oggi il modulo tiene solo il canone. Da decidere se
aggiungerle.

**Kena** (fonte: \`SenzaCodice - Incentivazione Kena Dealer Tim ... Luglio 2026.pdf\`).
Compensi reali disponibili se un giorno la venderai: MNP Star 15 €, Standard 10 €,
AL 5 €, + rinnovato (35/30/5), superpremio a soglie, Ricarica Automatica 20 €,
Easy Europe 7/15 €, Pack 15/25/35 €, Subbyx 30 €. Oggi Kena è fuori scope.
`;

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

  console.log(NOTE_FINALI);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

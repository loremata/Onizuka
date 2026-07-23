/**
 * Importa il listino offerte TIM in StoreOffer, così al banco si sceglie
 * l'offerta e il canone arriva da solo (niente digitazione, niente errori sul
 * bill size — che scatta sui centesimi).
 *
 * Sorgente: Ecosistema Commerciale/TIM/_LISTINO_COMPLETO_TIM_30-06-2026.csv
 * Uso: npx tsx scripts/import-listino-tim.ts [percorso.csv]
 *
 * La pista suggerita (lineKey) viene mappata dalla categoria SOLO dove è
 * univoca. Dove è ambigua resta vuota: meglio farla scegliere che indovinare
 * e attribuire pezzi alla gara sbagliata.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const DEFAULT_CSV =
  "C:/Users/Mata/Desktop/Ecosistema Commerciale/TIM/_LISTINO_COMPLETO_TIM_30-06-2026.csv";

/** Categoria del listino → pista di gara. null = ambigua, la sceglie l'utente. */
function lineKeyFor(categoria: string, offerta = ""): string | null {
  const c = categoria.toUpperCase();
  const o = offerta.toUpperCase();
  // il nome batte la categoria: "TIM Unica Power" sta sotto FISSO - Loyalty
  // ma è la gara TIM Unica, non un accesso fisso.
  if (o.includes("UNICA")) return "TIM_UNICA";
  if (c.startsWith("FISSO")) return "ACCESSO_FISSO";
  if (c.startsWith("TIMFIN")) return "TIMFIN";
  if (c.startsWith("TIMVISION")) return "CONTENUTI";
  if (c.startsWith("ENERGIA")) return "ENERGIA";
  if (c.includes("NUOVI (MNP)")) return "MNP";
  if (c.includes("NUOVO NUMERO AL")) return "AL_PP";
  // MOBILE - CB / Convergenza / Roaming / Stranieri / eSIM / Turisti / Energia:
  // possono essere MNP o AL a seconda del caso concreto → si lascia scegliere.
  return null;
}

/**
 * Estrae il primo importo in euro: "29,90 €/mese (att. 39,90 €)" → 29.90
 *
 * Ritorna null per i MODIFICATORI di prezzo ("-10 €/mese", "+5 €/mese"): sono
 * sconti e opzioni sul canone di un'altra offerta, non offerte con un canone
 * proprio. Se entrassero in listino, al banco si sceglierebbe uno sconto come
 * se fosse un'offerta e il compenso risulterebbe calcolato su 10 € invece che
 * sul canone reale.
 */
function parseFee(raw: string): number | null {
  if (/^\s*[+-]/.test(raw)) return null;
  const m = raw.match(/(\d+(?:[.,]\d+)?)\s*€/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Split CSV rispettando le virgolette. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === ";" && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  const path = process.argv[2] ?? DEFAULT_CSV;
  const owner = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("Nessun utente ADMIN");

  // reimport pulito: le righe scartate dal parser non devono restare da prima
  const wiped = await prisma.storeOffer.deleteMany({ where: { ownerUserId: owner.id, brand: "TIM" } });
  if (wiped.count) console.log(`rimosse ${wiped.count} offerte TIM precedenti`);

  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const rows = lines.slice(1).map(splitCsvLine);

  let created = 0;
  let skipped = 0;
  let senzaPista = 0;
  let i = 0;

  for (const r of rows) {
    const [categoria, offerta, codice, canone, dettaglio, target] = r;
    if (!offerta?.trim()) continue;

    const feeEur = parseFee(canone ?? "");
    if (feeEur == null) {
      // offerte senza un canone leggibile (promo, sconti a percentuale…)
      skipped++;
      continue;
    }

    // il listino non ha sempre un codice: si genera una chiave stabile dal nome
    const code =
      codice?.trim() && codice.trim() !== "-"
        ? codice.trim().split("/")[0]
        : `AUTO-${offerta.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 28)}`;

    const lineKey = lineKeyFor(categoria ?? "", offerta);
    if (!lineKey) senzaPista++;

    await prisma.storeOffer.upsert({
      where: { ownerUserId_brand_code: { ownerUserId: owner.id, brand: "TIM", code } },
      update: {
        name: offerta.trim(),
        feeEur: new Prisma.Decimal(feeEur),
        lineKey,
        category: categoria?.trim() || null,
        target: [dettaglio, target].filter(Boolean).join(" · ").slice(0, 300) || null,
        active: true,
        sortOrder: i,
      },
      create: {
        ownerUserId: owner.id,
        brand: "TIM",
        code,
        name: offerta.trim(),
        feeEur: new Prisma.Decimal(feeEur),
        lineKey,
        category: categoria?.trim() || null,
        target: [dettaglio, target].filter(Boolean).join(" · ").slice(0, 300) || null,
        sortOrder: i,
      },
    });
    created++;
    i++;
  }

  console.log(`offerte importate/aggiornate: ${created}`);
  console.log(`saltate (canone non leggibile): ${skipped}`);
  console.log(`senza pista suggerita (da scegliere a mano): ${senzaPista}`);

  // quante cadono sotto il bill size: è l'informazione che vale di più
  const sotto8 = await prisma.storeOffer.count({
    where: { ownerUserId: owner.id, brand: "TIM", lineKey: { in: ["MNP", "AL_PP"] }, feeEur: { lt: 8 } },
  });
  const sopra9 = await prisma.storeOffer.count({
    where: { ownerUserId: owner.id, brand: "TIM", lineKey: { in: ["MNP", "AL_PP"] }, feeEur: { gte: 9 } },
  });
  console.log(`mobile sotto 8 € (NON pagano il gettone): ${sotto8} · da 9 € in su (gettone pieno): ${sopra9}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

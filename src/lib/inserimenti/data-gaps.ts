import { prisma } from "@/lib/prisma";

/**
 * VENDITE DA COMPLETARE — solo i dati mancanti che cambiano i SOLDI.
 *
 * Non è un controllo di completezza fine a sé stesso: elenca esclusivamente le
 * righe in cui il dato assente fa calcolare un compenso diverso da quello vero.
 * Esempio reale di luglio: 5 fissi Fastweb senza offerta vengono valorizzati con
 * il default della pista (180 €), ma le offerte vere vanno da 145 a 240 € —
 * fino a ±300 € su un mese da 2.750 €. Senza questo elenco il totale sembra
 * esatto e non lo è.
 *
 * Volutamente NON segnala i casi in cui il dato manca per buoni motivi: le FWA
 * ricaricabili non hanno canone perché sono pagate a gettone, e segnalarle
 * insegnerebbe solo a ignorare gli avvisi.
 */

export type SaleGap = {
  saleId: string;
  date: Date;
  brand: string;
  lineKey: string;
  /** Cosa manca, in parole. */
  missing: string;
  /** Valore attualmente applicato dal motore. */
  appliedEur: number | null;
  /** Estremi plausibili se il dato fosse corretto (per capire la posta in gioco). */
  rangeEur: { min: number; max: number } | null;
  /** true = cambia il compenso; false = serve alle gare ma non ai soldi. */
  affectsMoney: boolean;
};

export type SaleGapsReport = {
  month: string;
  gaps: SaleGap[];
  /** Quante toccano davvero il compenso. */
  moneyGaps: number;
  /** Quanto vale l'incertezza complessiva, in valore assoluto. */
  uncertaintyEur: number;
};

export async function loadSaleDataGaps(ownerUserId: string, month: string): Promise<SaleGapsReport> {
  const [sales, lines, offers] = await Promise.all([
    prisma.storeSale.findMany({
      where: { ownerUserId, month },
      select: {
        id: true,
        date: true,
        brand: true,
        lineKey: true,
        subtype: true,
        offerCode: true,
        feeEur: true,
        provenance: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.incentiveLine.findMany({
      where: { plan: { ownerUserId, month } },
      select: {
        key: true,
        unit: true,
        plan: { select: { brand: true } },
        tiers: { select: { minQty: true, value: true }, orderBy: { minQty: "asc" } },
      },
    }),
    prisma.storeOffer.findMany({
      where: { ownerUserId, compensoEur: { not: null } },
      select: { brand: true, code: true, compensoEur: true, lineKey: true },
    }),
  ]);

  const lineByKey = new Map(lines.map((l) => [`${l.plan.brand}|${l.key}`, l]));
  // Indicizzate per brand+PISTA: confrontare un fisso con le offerte mobile
  // darebbe un intervallo falso (58-240 invece di 145-240) e farebbe sembrare
  // incerta una cifra che incerta non è.
  const offersByLine = new Map<string, number[]>();
  for (const o of offers) {
    if (!o.lineKey) continue;
    const k = `${o.brand}|${o.lineKey}`;
    const arr = offersByLine.get(k) ?? [];
    arr.push(Number(o.compensoEur));
    offersByLine.set(k, arr);
  }

  const gaps: SaleGap[] = [];
  let uncertainty = 0;

  for (const s of sales) {
    const line = lineByKey.get(`${s.brand}|${s.lineKey}`);
    if (!line) continue;
    const defaultRate = line.tiers.length ? Number(line.tiers[0].value) : 0;

    // 1) Pista a gettone senza offerta, quando il listino ha valori DIVERSI:
    //    è lì che il default mente. Se il brand ha un prezzo solo, nessun dubbio.
    if (line.unit === "EUR_PER_PIECE" && !s.offerCode) {
      const lineOffers = offersByLine.get(`${s.brand}|${s.lineKey}`) ?? [];
      const distinct = Array.from(new Set(lineOffers));
      if (distinct.length > 1) {
        const min = Math.min(...distinct);
        const max = Math.max(...distinct);
        gaps.push({
          saleId: s.id,
          date: s.date,
          brand: s.brand,
          lineKey: s.lineKey,
          missing: "offerta venduta",
          appliedEur: defaultRate,
          rangeEur: { min, max },
          affectsMoney: true,
        });
        uncertainty += Math.max(Math.abs(max - defaultRate), Math.abs(defaultRate - min));
      }
    }

    // 2) Pista a moltiplicatore senza canone: il compenso è canone × moltiplicatore,
    //    quindi senza canone quella vendita vale zero. Eccezione legittima: le FWA
    //    ricaricabili, pagate a gettone e prive di canone per natura.
    const isGettoneFwa = s.lineKey === "ACCESSO_FISSO" && s.subtype === "FWA_RIC";
    if (line.unit === "MULTIPLIER_ON_FEE" && s.feeEur == null && !isGettoneFwa) {
      gaps.push({
        saleId: s.id,
        date: s.date,
        brand: s.brand,
        lineKey: s.lineKey,
        missing: "canone del cliente",
        appliedEur: 0,
        rangeEur: null,
        affectsMoney: true,
      });
    }

    // 3) MNP senza provenienza: serve alle gare, non al compenso della singola
    //    vendita — segnalata ma senza incertezza economica.
    if (s.lineKey === "MNP" && !s.provenance) {
      gaps.push({
        saleId: s.id,
        date: s.date,
        brand: s.brand,
        lineKey: s.lineKey,
        missing: "provenienza (operatore di origine)",
        appliedEur: null,
        rangeEur: null,
        affectsMoney: false,
      });
    }
  }

  // Prima quelle che cambiano i soldi: sono poche e vanno viste subito, non
  // annegate tra i dati di gara che il compenso non lo toccano.
  gaps.sort((a, b) => Number(b.affectsMoney) - Number(a.affectsMoney) || a.date.getTime() - b.date.getTime());

  return {
    month,
    gaps,
    moneyGaps: gaps.filter((g) => g.affectsMoney).length,
    uncertaintyEur: Math.round(uncertainty * 100) / 100,
  };
}

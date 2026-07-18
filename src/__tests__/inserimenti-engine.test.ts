/**
 * Test di parità del motore Inserimenti contro il CRUSCOTTO Excel del negozio
 * (Ecosistema Commerciale/TIM/Monitoraggio Incentivazione Luglio 2026.xlsx).
 *
 * Ogni caso riproduce una formula del cruscotto e verifica il compenso al
 * centesimo. È la "definition of done" della Fase 0: il motore è pronto quando
 * questi passano. I VALORI usati sono quelli delle lettere di luglio (che il
 * cruscotto usa); le soglie personalizzate di Mirko si applicano cambiando i
 * dati del piano, non il motore.
 */

import {
  computeLinear,
  computeTim,
  computeMonth,
  focusNow,
  billWeight,
  tierIndex,
  tierValue,
  type Line,
  type Plan,
  type Sale,
} from "@/lib/inserimenti/engine";

// --- fixture piste TIM (valori lettera luglio 2026) ---

const MNP: Line = {
  key: "MNP",
  label: "MNP",
  unit: "MULTIPLIER_ON_FEE",
  hasTiers: true,
  applyBillSize: true,
  domiciliationMode: "bonus",
  domiciliationValue: 1.2,
  tiers: [
    { minQty: 0, value: 1.2 },
    { minQty: 21, value: 2.3 },
    { minQty: 37, value: 2.9 },
    { minQty: 65, value: 4.0 },
    { minQty: 110, value: 5.2 },
    { minQty: 160, value: 5.8 },
  ],
};

const AL_PP: Line = {
  key: "AL_PP",
  label: "AL PP Nette",
  unit: "MULTIPLIER_ON_FEE",
  hasTiers: true,
  applyBillSize: true,
  domiciliationMode: "bonus",
  domiciliationValue: 1.5,
  tiers: [
    { minQty: 0, value: 0.2 },
    { minQty: 16, value: 0.6 },
    { minQty: 37, value: 2.1 },
    { minQty: 75, value: 2.3 },
    { minQty: 115, value: 2.5 },
  ],
};

const FISSO: Line = {
  key: "ACCESSO_FISSO",
  label: "Accessi Fisso",
  unit: "MULTIPLIER_ON_FEE",
  hasTiers: true,
  applyBillSize: false,
  domiciliationMode: "split",
  nonDomiciledValue: 1.7,
  tiers: [
    { minQty: 0, value: 0 },
    { minQty: 3, value: 1.7 },
    { minQty: 9, value: 4.5 },
    { minQty: 17, value: 5.0 },
    { minQty: 27, value: 6.5 },
  ],
};

const ENERGIA: Line = {
  key: "ENERGIA",
  label: "Energia",
  unit: "EUR_PER_PIECE",
  hasTiers: true,
  pxqEur: 10,
  tiers: [
    { minQty: 0, value: 0 },
    { minQty: 4, value: 20 },
    { minQty: 8, value: 40 },
  ],
};

const PARAMS = {
  billSize: { full: 9, half: 8 },
  alPpPenalty: { threshold: 16, delta: 0.5 },
};

const timPlan = (lines: Line[]): Plan => ({
  brand: "TIM",
  month: "2026-07",
  engineVersion: "tim-2026-07",
  lines,
  prizes: [],
  params: PARAMS,
});

const mnpSale = (fee: number, domiciled = false): Sale => ({
  lineKey: "MNP",
  feeEur: fee,
  domiciled,
});

// ============================================================ helper primitivi

describe("helper", () => {
  test("bill size è un interruttore: pieno / metà / escluso", () => {
    const bill = { full: 9, half: 8 };
    expect(billWeight(9.99, bill)).toBe(1);
    expect(billWeight(9, bill)).toBe(1);
    expect(billWeight(8.5, bill)).toBe(0.5);
    expect(billWeight(8, bill)).toBe(0.5);
    expect(billWeight(7.99, bill)).toBe(0); // sotto 8 → zero gettone di gara
  });

  test("tierValue e tierIndex seguono gli scaglioni", () => {
    expect(tierValue(0, MNP.tiers)).toBe(1.2);
    expect(tierValue(20, MNP.tiers)).toBe(1.2);
    expect(tierValue(21, MNP.tiers)).toBe(2.3);
    expect(tierValue(37, MNP.tiers)).toBe(2.9);
    expect(tierIndex(37, MNP.tiers)).toBe(2);
    expect(tierValue(999, MNP.tiers)).toBe(5.8);
  });
});

// ============================================================ percorso lineare

describe("computeLinear", () => {
  test("qty × €/pezzo, nessuna soglia", () => {
    const plan: Plan = {
      brand: "ENI",
      month: "2026-07",
      engineVersion: "linear",
      lines: [
        { key: "TELEPASS", label: "Telepass", unit: "EUR_PER_PIECE", hasTiers: false, tiers: [{ minQty: 0, value: 5 }] },
      ],
      prizes: [],
      params: {},
    };
    const sales: Sale[] = Array.from({ length: 10 }, () => ({ lineKey: "TELEPASS", domiciled: false }));
    const r = computeMonth(plan, sales);
    expect(r.total).toBe(50);
    expect(r.lines[0].qty).toBe(10);
    expect(r.lines[0].nextThreshold).toBeNull(); // niente soglia: nessun focus finto
  });

  test("il percorso lineare NON eredita bill size né soglie", () => {
    // una vendita a canone basso, che su TIM varrebbe zero, qui vale il gettone pieno
    const plan: Plan = {
      brand: "FASTWEB",
      month: "2026-07",
      engineVersion: "linear",
      lines: [{ key: "MOBILE", label: "Mobile", unit: "EUR_PER_PIECE", hasTiers: false, tiers: [{ minQty: 0, value: 48 }] }],
      prizes: [],
      params: {},
    };
    const r = computeLinear(plan, [{ lineKey: "MOBILE", feeEur: 5, domiciled: false }]);
    expect(r.total).toBe(48);
  });
});

// ============================================================ gara MNP (cuore)

describe("MNP — moltiplicatore sul canone", () => {
  test("soglia 1, non domiciliato, canone pieno: 1,2 × 10 = 12", () => {
    const r = computeTim(timPlan([MNP, AL_PP]), [mnpSale(10)], {});
    // AL_PP a 0 → penalità attiva → mult 1,2 - 0,5 = 0,7? No: la penalità colpisce
    // solo se AL_PP < 16. Qui AL_PP=0 < 16 → sì penalità. Quindi 0,7 × 10 = 7.
    expect(r.lines[0].compenso).toBe(7);
  });

  test("penalità AL PP: sotto soglia 16 tutte le MNP perdono 0,5", () => {
    const withPenalty = computeTim(timPlan([MNP, AL_PP]), [mnpSale(10)], {}).lines[0].compenso;
    // 16 AL PP per togliere la penalità
    const alSales: Sale[] = Array.from({ length: 16 }, () => ({ lineKey: "AL_PP", feeEur: 10, domiciled: false }));
    const noPenalty = computeTim(timPlan([MNP, AL_PP]), [mnpSale(10), ...alSales], {}).lines[0].compenso;
    expect(withPenalty).toBe(7); // 0,7 × 10
    expect(noPenalty).toBe(12); // 1,2 × 10
  });

  test("domiciliazione: bonus +1,2 sul canone domiciliato", () => {
    // 16 AL per togliere la penalità, poi confronto MNP domiciliata vs no
    const alSales: Sale[] = Array.from({ length: 16 }, () => ({ lineKey: "AL_PP", feeEur: 10, domiciled: false }));
    const nonDom = computeTim(timPlan([MNP, AL_PP]), [mnpSale(10, false), ...alSales], {}).lines[0].compenso;
    const dom = computeTim(timPlan([MNP, AL_PP]), [mnpSale(10, true), ...alSales], {}).lines[0].compenso;
    expect(nonDom).toBe(12); // 1,2 × 10
    expect(dom).toBe(24); // (1,2 + 1,2) × 10
  });

  test("bill size a 8,50 conta metà; a 7,99 conta zero", () => {
    const al: Sale[] = Array.from({ length: 16 }, () => ({ lineKey: "AL_PP", feeEur: 10, domiciled: false }));
    const half = computeTim(timPlan([MNP, AL_PP]), [mnpSale(8.5), ...al], {}).lines[0].compenso;
    const zero = computeTim(timPlan([MNP, AL_PP]), [mnpSale(7.99), ...al], {}).lines[0].compenso;
    expect(half).toBe(5.1); // 1,2 × 8,50 × 0,5
    expect(zero).toBe(0); // sotto 8 → escluso
  });

  test("rivalutazione retroattiva: superare la soglia rivaluta TUTTO il mese", () => {
    // 21 MNP domiciliate da 10 € → soglia 2 (2,3). Tutte e 21 valgono (2,3+1,2)×10.
    const al: Sale[] = Array.from({ length: 16 }, () => ({ lineKey: "AL_PP", feeEur: 10, domiciled: false }));
    const mnp: Sale[] = Array.from({ length: 21 }, () => mnpSale(10, true));
    const r = computeTim(timPlan([MNP, AL_PP]), [...mnp, ...al], {});
    expect(r.lines[0].qty).toBe(21);
    expect(r.lines[0].tierIndex).toBe(1); // scaglione 2
    expect(r.lines[0].compenso).toBe(21 * (2.3 + 1.2) * 10); // 2205
  });
});

// ============================================================ gara Fisso (split)

describe("Fisso — domiciliati a scaglione, non domiciliati flat 1,7", () => {
  test("9 accessi domiciliati da 30 €: scaglione 3 (4,5) × canoni", () => {
    const sales: Sale[] = Array.from({ length: 9 }, () => ({ lineKey: "ACCESSO_FISSO", feeEur: 30, domiciled: true }));
    const r = computeTim(timPlan([FISSO]), sales, {});
    expect(r.lines[0].tierIndex).toBe(2); // ≥9 → scaglione 3
    expect(r.lines[0].compenso).toBe(9 * 4.5 * 30); // 1215
  });

  test("non domiciliati restano a 1,7 anche in scaglione alto", () => {
    // 9 pezzi totali (soglia 3), ma il singolo non domiciliato vale 1,7
    const dom: Sale[] = Array.from({ length: 8 }, () => ({ lineKey: "ACCESSO_FISSO", feeEur: 30, domiciled: true }));
    const nd: Sale = { lineKey: "ACCESSO_FISSO", feeEur: 30, domiciled: false };
    const r = computeTim(timPlan([FISSO]), [...dom, nd], {});
    // 8 domiciliati × 4,5 × 30 + 1 non-dom × 1,7 × 30 = 1080 + 51 = 1131
    expect(r.lines[0].compenso).toBe(8 * 4.5 * 30 + 1 * 1.7 * 30);
  });
});

// ============================================================ Energia (PxQ+vol)

describe("Energia — PxQ additivo + volume", () => {
  test("3 contratti: (10 PxQ + 0 volume) × 3 = 30", () => {
    const sales: Sale[] = Array.from({ length: 3 }, () => ({ lineKey: "ENERGIA", domiciled: false }));
    const r = computeTim(timPlan([ENERGIA]), sales, {});
    expect(r.lines[0].compenso).toBe(30);
  });

  test("4 contratti sbloccano il volume: (10 + 20) × 4 = 120", () => {
    const sales: Sale[] = Array.from({ length: 4 }, () => ({ lineKey: "ENERGIA", domiciled: false }));
    const r = computeTim(timPlan([ENERGIA]), sales, {});
    expect(r.lines[0].tierIndex).toBe(1);
    expect(r.lines[0].compenso).toBe(120);
  });
});

// ============================================================ Top Club (cancelli AND)

describe("Top Club — cancelli in AND", () => {
  const topClubPlan = (): Plan => ({
    brand: "TIM",
    month: "2026-07",
    engineVersion: "tim-2026-07",
    lines: [MNP, FISSO],
    params: PARAMS,
    prizes: [
      {
        key: "TOP_CLUB",
        label: "Top Club",
        minPoints: 180,
        maxPoints: 300,
        minPrize: 1000,
        maxPrize: 2000,
        gates: [
          { lineKey: "ACCESSO_FISSO", minQty: 17 },
          { lineKey: "MNP", minQty: 37 },
        ],
        scoreKpis: [
          { key: "ACCESSO_FISSO", label: "Accessi", points: 4, source: "DERIVED" },
          { key: "MNP", label: "MNP", points: 2, source: "DERIVED" },
        ],
        bonuses: [{ conditionLineKey: "ENERGIA", conditionMinQty: 4, pct: 0.3 }],
        halvings: [],
      },
    ],
  });

  test("un cancello mancante azzera il premio, non lo riduce", () => {
    // Fisso a 17 (ok) ma MNP a 10 (< 37): premio ZERO anche con punteggio alto
    const fisso: Sale[] = Array.from({ length: 17 }, () => ({ lineKey: "ACCESSO_FISSO", feeEur: 30, domiciled: true }));
    const mnp: Sale[] = Array.from({ length: 10 }, () => mnpSale(10));
    const r = computeTim(topClubPlan(), [...fisso, ...mnp], {});
    const tc = r.prizes[0];
    expect(tc.gateOpen).toBe(false);
    expect(tc.worstGate?.lineKey).toBe("MNP"); // manca di più
    expect(tc.worstGate?.missing).toBe(27);
    expect(tc.prize).toBe(0);
  });

  test("cancelli aperti: premio interpolato sul punteggio", () => {
    // Fisso 17 (68 pt) + MNP 37 (74 pt) = 142 pt < 180 → sotto soglia minima, premio 0
    const fisso: Sale[] = Array.from({ length: 17 }, () => ({ lineKey: "ACCESSO_FISSO", feeEur: 30, domiciled: true }));
    const mnp: Sale[] = Array.from({ length: 37 }, () => mnpSale(10));
    const r = computeTim(topClubPlan(), [...fisso, ...mnp], {});
    const tc = r.prizes[0];
    expect(tc.gateOpen).toBe(true);
    expect(tc.points).toBe(17 * 4 + 37 * 2); // 142
    expect(tc.prize).toBe(0); // 142 < 180
  });

  test("punteggio 180 esatto → premio minimo 1.000", () => {
    // servono 180 pt con cancelli aperti: 20 Fisso (80) + 50 MNP (100) = 180
    const fisso: Sale[] = Array.from({ length: 20 }, () => ({ lineKey: "ACCESSO_FISSO", feeEur: 30, domiciled: true }));
    const mnp: Sale[] = Array.from({ length: 50 }, () => mnpSale(10));
    const r = computeTim(topClubPlan(), [...fisso, ...mnp], {});
    const tc = r.prizes[0];
    expect(tc.gateOpen).toBe(true);
    expect(tc.points).toBe(180);
    expect(tc.base).toBe(1000);
    expect(tc.prize).toBe(1000);
  });

  test("bonus Energia +30% quando ≥4 contratti", () => {
    const fisso: Sale[] = Array.from({ length: 20 }, () => ({ lineKey: "ACCESSO_FISSO", feeEur: 30, domiciled: true }));
    const mnp: Sale[] = Array.from({ length: 50 }, () => mnpSale(10));
    const energia: Sale[] = Array.from({ length: 4 }, () => ({ lineKey: "ENERGIA", domiciled: false }));
    const r = computeTim(topClubPlan(), [...fisso, ...mnp, ...energia], {});
    const tc = r.prizes[0];
    expect(tc.base).toBe(1000);
    expect(tc.bonus).toBe(300); // +30%
    expect(tc.prize).toBe(1300);
  });
});

// ============================================================ FOCUS ORA

describe("focusNow", () => {
  test("classifica per €/pezzo mancante, solo piste a soglie", () => {
    // MNP a 20 (1 pezzo dalla soglia 21) con canoni alti → scatto ricco
    const al: Sale[] = Array.from({ length: 16 }, () => ({ lineKey: "AL_PP", feeEur: 10, domiciled: false }));
    const mnp: Sale[] = Array.from({ length: 20 }, () => mnpSale(20, false));
    const plan = timPlan([MNP, AL_PP]);
    const r = computeTim(plan, [...mnp, ...al], {});
    const focus = focusNow(plan, r);
    expect(focus[0].lineKey).toBe("MNP");
    expect(focus[0].missing).toBe(1);
    // scatto: da 1,2 a 2,3 su 20 canoni da 20 € = (2,3-1,2)×20×20 = 440
    expect(focus[0].stepValue).toBe(440);
    expect(focus[0].priority).toBe(440);
  });

  test("le piste lineari non entrano nel focus", () => {
    const plan: Plan = {
      brand: "FASTWEB",
      month: "2026-07",
      engineVersion: "linear",
      lines: [{ key: "MOBILE", label: "Mobile", unit: "EUR_PER_PIECE", hasTiers: false, tiers: [{ minQty: 0, value: 48 }] }],
      prizes: [],
      params: {},
    };
    const r = computeLinear(plan, [{ lineKey: "MOBILE", domiciled: false }]);
    expect(focusNow(plan, r)).toHaveLength(0);
  });
});

// --------------------------------------------------------------------------
// Percorso lineare esteso (18/07/2026): moltiplicatore sul canone e compenso
// per singola offerta.
// --------------------------------------------------------------------------

describe("computeLinear — moltiplicatore sul canone (Fastweb business, Iliad)", () => {
  const planMult: Plan = {
    brand: "FASTWEB",
    month: "2026-07",
    engineVersion: "linear",
    params: {},
    prizes: [],
    lines: [
      {
        key: "FISSO_BUSINESS",
        label: "Fisso business",
        unit: "MULTIPLIER_ON_FEE",
        hasTiers: false,
        tiers: [{ minQty: 0, value: 5 }],
      },
    ],
  };

  test("compenso = moltiplicatore × somma dei canoni", () => {
    const r = computeMonth(planMult, [
      { lineKey: "FISSO_BUSINESS", feeEur: 40, domiciled: false },
      { lineKey: "FISSO_BUSINESS", feeEur: 60, domiciled: false },
    ]);
    expect(r.lines[0].compenso).toBe(500); // 5 × (40+60)
    expect(r.lines[0].eligibleFee).toBe(100);
  });

  test("nessun bill size sul percorso lineare: un canone basso conta comunque", () => {
    const r = computeMonth(planMult, [{ lineKey: "FISSO_BUSINESS", feeEur: 5, domiciled: false }]);
    expect(r.lines[0].compenso).toBe(25); // 5 × 5, non escluso
  });

  test("Iliad: moltiplicatore 1 = il compenso è la spesa mensile", () => {
    const iliad: Plan = {
      ...planMult,
      brand: "ILIAD",
      lines: [{ key: "MNP", label: "Iliad", unit: "MULTIPLIER_ON_FEE", hasTiers: false, tiers: [{ minQty: 0, value: 1 }] }],
    };
    const r = computeMonth(iliad, [
      { lineKey: "MNP", feeEur: 9.99, domiciled: false },
      { lineKey: "MNP", feeEur: 11.99, domiciled: false },
    ]);
    expect(r.total).toBe(21.98);
  });
});

describe("computeLinear — compenso per singola offerta", () => {
  const plan: Plan = {
    brand: "FASTWEB",
    month: "2026-07",
    engineVersion: "linear",
    params: {},
    prizes: [],
    lines: [{ key: "FISSO", label: "Fisso", unit: "EUR_PER_PIECE", hasTiers: false, tiers: [{ minQty: 0, value: 180 }] }],
  };

  test("senza compenso specifico si usa quello della pista", () => {
    const r = computeMonth(plan, [{ lineKey: "FISSO", domiciled: false }]);
    expect(r.lines[0].compenso).toBe(180);
  });

  test("il compenso dell'offerta vince su quello della pista", () => {
    const r = computeMonth(plan, [{ lineKey: "FISSO", domiciled: false, unitCompenso: 240 }]);
    expect(r.lines[0].compenso).toBe(240);
  });

  test("offerte diverse nello stesso mese pagano diversamente", () => {
    const r = computeMonth(plan, [
      { lineKey: "FISSO", domiciled: false, unitCompenso: 145 }, // Casa Start
      { lineKey: "FISSO", domiciled: false, unitCompenso: 240 }, // Casa Ultra
      { lineKey: "FISSO", domiciled: false }, // fuori listino → valore pista
    ]);
    expect(r.lines[0].qty).toBe(3);
    expect(r.lines[0].compenso).toBe(565); // 145 + 240 + 180
  });
});

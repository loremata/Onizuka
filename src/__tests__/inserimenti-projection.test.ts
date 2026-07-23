/**
 * Test della proiezione a fine mese e della raggiungibilità dei cancelli.
 * Scenario di riferimento: luglio 2026 reale del negozio.
 */
import { projectQty, buildOutlook, daysInMonth } from "@/lib/inserimenti/projection";
import type { Plan, MonthResult } from "@/lib/inserimenti/engine";

describe("projectQty", () => {
  test("estrapola il ritmo sul mese intero", () => {
    expect(projectQty(6, 15, 31)).toBe(12); // 0,4/gg × 31 ≈ 12
    expect(projectQty(10, 10, 30)).toBe(30);
    expect(projectQty(0, 17, 31)).toBe(0);
  });

  test("a mese finito la proiezione coincide col reale", () => {
    expect(projectQty(9, 31, 31)).toBe(9);
  });

  test("giorno 0 non divide per zero", () => {
    expect(projectQty(5, 0, 31)).toBe(5);
  });
});

describe("daysInMonth", () => {
  test("mesi di lunghezza diversa", () => {
    expect(daysInMonth("2026-07")).toBe(31);
    expect(daysInMonth("2026-06")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
  });
});

const plan: Plan = {
  brand: "TIM",
  month: "2026-07",
  engineVersion: "tim-2026-07",
  params: {},
  lines: [
    {
      key: "MNP",
      label: "Mobile MNP",
      unit: "MULTIPLIER_ON_FEE",
      hasTiers: true,
      tiers: [
        { minQty: 0, value: 1.2 },
        { minQty: 19, value: 2.3 },
        { minQty: 34, value: 2.9 },
      ],
    },
    {
      key: "ACCESSO_FISSO",
      label: "Accessi Fisso",
      unit: "MULTIPLIER_ON_FEE",
      hasTiers: true,
      tiers: [
        { minQty: 0, value: 0 },
        { minQty: 3, value: 1.7 },
        { minQty: 8, value: 4.5 },
        { minQty: 16, value: 5.0 },
      ],
    },
  ],
  prizes: [
    {
      key: "TOP_CLUB",
      label: "Top Club",
      minPoints: 180,
      maxPoints: 300,
      minPrize: 1000,
      maxPrize: 2000,
      gates: [
        { lineKey: "ACCESSO_FISSO", minQty: 16 },
        { lineKey: "MNP", minQty: 34 },
      ],
      scoreKpis: [],
      bonuses: [],
      halvings: [],
    },
  ],
};

const result = (mnp: number, fisso: number): MonthResult => ({
  brand: "TIM",
  extras: 0,
  total: 0,
  prizes: [],
  lines: [
    { key: "MNP", label: "Mobile MNP", qty: mnp, eligibleFee: 0, compenso: 0, tierIndex: 0, nextThreshold: 19, missing: Math.max(0, 19 - mnp), stepValue: 0 },
    { key: "ACCESSO_FISSO", label: "Accessi Fisso", qty: fisso, eligibleFee: 0, compenso: 0, tierIndex: 1, nextThreshold: 8, missing: Math.max(0, 8 - fisso), stepValue: 0 },
  ],
});

describe("buildOutlook — luglio reale del negozio (6 MNP, 5 fissi al giorno 17)", () => {
  const o = buildOutlook(plan, result(6, 5), 17, 31);

  test("proietta i pezzi a fine mese", () => {
    const mnp = o.lines.find((l) => l.key === "MNP")!;
    expect(mnp.projectedQty).toBe(11); // 6/17 × 31
    expect(mnp.willImprove).toBe(false); // resta sotto la soglia 19
  });

  test("il Top Club risulta PERSO: il cancello MNP è fuori portata", () => {
    const tc = o.prizes.find((p) => p.key === "TOP_CLUB")!;
    expect(tc.gateOpen).toBe(false);
    expect(tc.lost).toBe(true);
  });

  test("il cancello messo peggio viene per primo", () => {
    const tc = o.prizes.find((p) => p.key === "TOP_CLUB")!;
    expect(tc.gates[0].lineKey).toBe("MNP");
    expect(tc.gates[0].missing).toBe(28); // 34 - 6
  });

  test("dice quanti pezzi al giorno servirebbero", () => {
    const tc = o.prizes.find((p) => p.key === "TOP_CLUB")!;
    const mnpGate = tc.gates.find((g) => g.lineKey === "MNP")!;
    expect(mnpGate.perDayNeeded).toBe(2); // 28 mancanti / 14 giorni
  });

  test("giorni rimanenti", () => {
    expect(o.daysLeft).toBe(14);
  });
});

describe("buildOutlook — scenario in cui il cancello è ancora vivo", () => {
  test("con 30 MNP e 15 fissi al giorno 17 il premio non è perso", () => {
    const o = buildOutlook(plan, result(30, 15), 17, 31);
    const tc = o.prizes.find((p) => p.key === "TOP_CLUB")!;
    expect(tc.lost).toBe(false);
  });

  test("a mese finito senza cancelli aperti il premio è perso", () => {
    const o = buildOutlook(plan, result(6, 5), 31, 31);
    const tc = o.prizes.find((p) => p.key === "TOP_CLUB")!;
    expect(tc.lost).toBe(true);
    expect(o.daysLeft).toBe(0);
  });
});

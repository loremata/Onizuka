import type { ClientKind, ClientMacroCategory, ClientStatus } from "@prisma/client";

/**
 * Customer scoring composito 0-100 a 6 dimensioni pesate (somma 100).
 * Affianca (non sostituisce) health-score e audit-score esistenti: misura il
 * VALORE e la PRIORITÀ commerciale del cliente, tarato sul modello a ricorrente.
 *
 * Dimensioni: Monetary 25 · Ricorrenti 20 · Ampiezza 15 · Recency 15 · ICP 15 · Relazione 10.
 */
export type CustomerScoreBand = "hot" | "warm" | "cold" | "low";

export type CustomerScore = {
  score: number;
  band: CustomerScoreBand;
  breakdown: {
    monetary: number;
    recurring: number;
    frequency: number;
    recency: number;
    icp: number;
    relation: number;
  };
  factors: string[];
};

export type CustomerScoreInput = {
  status: ClientStatus;
  kind: ClientKind | null;
  macroCategory: ClientMacroCategory | null;
  hasVat: boolean;
  /** Somma estimatedValue delle opportunità WON (valore generato). */
  wonValueEur: number;
  /** Streams ricorrenti attivi (contratti retail + servizi ricorrenti). */
  activeRecurringCount: number;
  /** Categorie di servizio distinte attive con noi. */
  activeCategoryCount: number;
  /** Mesi dall'ultima attività/aggiornamento. */
  monthsSinceActivity: number;
  overdueFinance: number;
  openTickets: number;
  contactsCount: number;
};

function scoreMonetary(wonValueEur: number): number {
  if (wonValueEur <= 0) return 0;
  if (wonValueEur <= 500) return 8;
  if (wonValueEur <= 2000) return 14;
  if (wonValueEur <= 5000) return 19;
  if (wonValueEur <= 12000) return 23;
  return 25;
}

function scoreRecurring(count: number): number {
  return [0, 8, 14, 18, 20][Math.min(Math.max(count, 0), 4)];
}

function scoreFrequency(categories: number): number {
  return Math.min(15, Math.max(0, categories) * 3);
}

function scoreRecency(months: number): number {
  if (months <= 1) return 15;
  if (months <= 3) return 12;
  if (months <= 6) return 8;
  if (months <= 12) return 4;
  return 0;
}

function scoreIcp(input: CustomerScoreInput): number {
  const kindPts = input.kind === "BUSINESS" ? 8 : 4;
  const macroPts =
    input.macroCategory === "DIGITAL_AI" ? 4 : input.macroCategory === "MIXED" ? 3 : input.macroCategory === "RETAIL_STORE" ? 2 : 2;
  const vatPts = input.hasVat ? 3 : 0;
  return Math.min(15, kindPts + macroPts + vatPts);
}

function scoreRelation(input: CustomerScoreInput): number {
  let pts = 10;
  pts -= Math.min(input.overdueFinance * 3, 6);
  pts -= Math.min(input.openTickets * 2, 4);
  return Math.max(0, pts);
}

export function bandOf(score: number): CustomerScoreBand {
  if (score >= 80) return "hot";
  if (score >= 55) return "warm";
  if (score >= 30) return "cold";
  return "low";
}

export function computeCustomerScore(input: CustomerScoreInput): CustomerScore {
  const breakdown = {
    monetary: scoreMonetary(input.wonValueEur),
    recurring: scoreRecurring(input.activeRecurringCount),
    frequency: scoreFrequency(input.activeCategoryCount),
    recency: scoreRecency(input.monthsSinceActivity),
    icp: scoreIcp(input),
    relation: scoreRelation(input),
  };
  const score = Math.round(
    breakdown.monetary + breakdown.recurring + breakdown.frequency + breakdown.recency + breakdown.icp + breakdown.relation,
  );
  const factors = [
    `Valore generato: € ${Math.round(input.wonValueEur).toLocaleString("it-IT")} (${breakdown.monetary}/25)`,
    `Ricorrenti attivi: ${input.activeRecurringCount} (${breakdown.recurring}/20)`,
    `Categorie attive: ${input.activeCategoryCount} (${breakdown.frequency}/15)`,
    `Ultima attività: ${input.monthsSinceActivity} mesi (${breakdown.recency}/15)`,
    `ICP fit (${breakdown.icp}/15) · Relazione (${breakdown.relation}/10)`,
  ];
  return { score, band: bandOf(score), breakdown, factors };
}

export const CUSTOMER_BAND_LABEL: Record<CustomerScoreBand, string> = {
  hot: "HOT / VIP",
  warm: "WARM",
  cold: "COLD",
  low: "LOW",
};

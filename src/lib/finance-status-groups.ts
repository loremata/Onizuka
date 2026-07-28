import type { FinanceEntryStatus } from "@prisma/client";

/** Voci ancora aperte: attese, pianificate o scadute. */
export const FINANCE_STATUS_OPEN: FinanceEntryStatus[] = ["PLANNED", "EXPECTED", "OVERDUE"];

/**
 * Voci chiuse. L'interfaccia consente sia `RECEIVED` sia `PAID` su entrambi i tipi
 * (INCOME ed EXPENSE), quindi vanno sempre considerate insieme: filtrare le entrate
 * sul solo `RECEIVED` faceva sparire dai cruscotti quelle segnate `PAID` — con l'unica
 * entrata reale a sistema, un buco da 3.000 € su previsione del mese e distanza dal
 * target.
 */
export const FINANCE_STATUS_SETTLED: FinanceEntryStatus[] = ["RECEIVED", "PAID"];

/** Tutti gli stati che rappresentano una voce viva (nessuno è escluso oggi). */
export const FINANCE_STATUS_ALL: FinanceEntryStatus[] = [
  ...FINANCE_STATUS_OPEN,
  ...FINANCE_STATUS_SETTLED,
];

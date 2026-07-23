/** Formattazione numeri del modulo Inserimenti — UNICA fonte.
 *  Prima viveva copiata in 5 file con decimali diversi; ora chi vuole gli
 *  interi usa eur0, chi vuole i centesimi usa eur. */

export const itNum = (n: number, dec = 0) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: dec });

/** "€ 1.567,5" — fino a 2 decimali, per compensi puntuali. */
export const eur = (n: number) => "€ " + itNum(n, 2);

/** "€ 1.568" — arrotondato, per recap e obiettivi. */
export const eur0 = (n: number) => "€ " + itNum(n, 0);

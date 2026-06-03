/**
 * Formattazione date in ora italiana con fuso ESPLICITO.
 *
 * Vercel esegue il runtime in UTC e riserva il nome env `TZ`, inoltre V8 mette in
 * cache il fuso di default: per questo le date vanno formattate passando sempre
 * `timeZone` esplicito. Override con ONIZUKA_RECAP_TIMEZONE; default Italia.
 */
export const ITALY_TZ = process.env.ONIZUKA_RECAP_TIMEZONE?.trim() || "Europe/Rome";

/** Equivalente di `new Intl.DateTimeFormat("it-IT", …)` ma con fuso Italia esplicito. */
export function dateTimeFormatIt(
  options: Intl.DateTimeFormatOptions = {}
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("it-IT", { timeZone: ITALY_TZ, ...options });
}

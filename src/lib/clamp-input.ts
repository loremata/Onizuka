/**
 * Normalizza un valore in ingresso da payload pubblici non fidati:
 * forza a stringa, taglia gli spazi e limita la lunghezza massima.
 * Serve a evitare storage-abuse / payload sproporzionati dai form pubblici.
 */
export function clampStr(value: unknown, maxLen: number): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

/** Limiti condivisi per i campi dei form pubblici (lead ingestion). */
export const PUBLIC_FIELD_LIMITS = {
  name: 120,
  email: 254,
  phone: 40,
  company: 200,
  vat: 32,
  fiscalCode: 32,
  city: 120,
  freeText: 2000,
  consentText: 500,
} as const;

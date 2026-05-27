/**
 * Punto unico per normalizzazione identificativi fiscali (P.IVA / CF).
 * Usare sempre queste funzioni in lookup, create, update, import e script DB.
 */
import { normalizeFiscalCode, normalizeVatNumber } from "@/lib/client-kind";

export { normalizeVatNumber, normalizeFiscalCode, inferClientKind } from "@/lib/client-kind";

export type NormalizedFiscalIdentity = {
  vatNumber: string | null;
  fiscalCode: string | null;
};

/** Normalizza entrambi i campi; stringhe vuote → null. */
export function normalizeFiscalIdentity(params: {
  vatNumber?: string | null;
  fiscalCode?: string | null;
}): NormalizedFiscalIdentity {
  return {
    vatNumber: normalizeVatNumber(params.vatNumber),
    fiscalCode: normalizeFiscalCode(params.fiscalCode),
  };
}

/** Valore grezzo che in DB dovrebbe essere NULL (spazi, vuoto). */
export function isBlankFiscalRaw(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  return raw.trim().replace(/\s/g, "") === "";
}

/** True se il valore salvato differisce dalla forma normalizzata (da correggere in backfill). */
export function fiscalValueNeedsNormalization(
  raw: string | null | undefined,
  kind: "vat" | "cf"
): boolean {
  if (isBlankFiscalRaw(raw)) return raw != null && raw !== "";
  const norm = kind === "vat" ? normalizeVatNumber(raw) : normalizeFiscalCode(raw);
  if (!norm) return true;
  return raw !== norm;
}

/**
 * Riconoscimento comando P.IVA prospect — solo regex, safe per bundle client.
 * La pipeline server è in prospect-vat-pipeline.ts.
 */

const VAT_EXTRACT =
  /(?:partita\s*iva|p\.?\s*iva|piva)\s*[:\s]*([A-Z]{0,2}\d{9,11})/i;

/** Estrae P.IVA da comando naturale (PUNTO-SITUA §13). */
export function extractVatFromProspectCommand(raw: string): string | null {
  const t = raw.trim();
  const m = t.match(VAT_EXTRACT) ?? t.match(/\b(IT)?(\d{11})\b/);
  if (!m) return null;
  const digits = (m[1] ?? m[2] ?? "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  return digits.length === 11 ? digits : digits.slice(-11);
}

function detectProspectIntent(raw: string): boolean {
  return (
    /\b(inserisci|aggiungi|crea)\b.*\b(prospect|lead)\b/i.test(raw) ||
    /\bprospect\b.*\b(digital|digitale|ai)\b/i.test(raw) ||
    /\bpartita\s*iva\b/i.test(raw)
  );
}

export function isProspectVatCommand(raw: string): boolean {
  return detectProspectIntent(raw) && !!extractVatFromProspectCommand(raw);
}

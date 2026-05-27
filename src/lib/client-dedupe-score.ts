import { levenshtein, normalizeCompanyDedupeKey, normalizeEmail, normalizeVat } from "@/lib/client-dedupe";

export type DedupePairInput = {
  companyName: string;
  contactEmail: string;
  vatNumber: string | null;
  phone?: string | null;
};

/** Punteggio 0–100 di probabilità duplicato (euristica, non ML). */
export function duplicatePairScore(a: DedupePairInput, b: DedupePairInput): number {
  let score = 0;

  const vatA = normalizeVat(a.vatNumber);
  const vatB = normalizeVat(b.vatNumber);
  if (vatA && vatB && vatA === vatB) return 100;

  const emailA = normalizeEmail(a.contactEmail);
  const emailB = normalizeEmail(b.contactEmail);
  if (emailA && emailB && emailA === emailB) score = Math.max(score, 95);

  const nameA = normalizeCompanyDedupeKey(a.companyName);
  const nameB = normalizeCompanyDedupeKey(b.companyName);
  if (nameA && nameB) {
    if (nameA === nameB) score = Math.max(score, 90);
    else {
      const dist = levenshtein(nameA, nameB);
      const maxLen = Math.max(nameA.length, nameB.length);
      if (maxLen > 0 && dist <= 2) score = Math.max(score, 75 - dist * 5);
    }
  }

  return Math.min(100, Math.max(0, score));
}

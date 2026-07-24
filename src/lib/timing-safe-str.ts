import { timingSafeEqual } from "crypto";

/**
 * Confronto di stringhe/segreti resistente ai timing attack.
 * Ritorna true SSE `a` e `b` sono definiti e identici byte-per-byte.
 * La lunghezza può essere dedotta (inevitabile) ma il contenuto no.
 */
export function timingSafeStrEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

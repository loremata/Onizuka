import type { Client } from "@prisma/client";
import { normalizeEmail, normalizeVat } from "@/lib/client-dedupe";

/**
 * Un'email segnaposto (`lead+<id>@onizuka.local`, `prospect+<piva>@onizuka.local`)
 * non è un recapito: è un riempitivo generato da noi, diverso per ogni record
 * per costruzione. Trattarla come un'email vera rendeva DUE SCONOSCIUTI un
 * "conflitto di email" e bloccava il merge proprio sul caso più frequente —
 * in produzione 775 clienti su 1.028 ce l'hanno, quindi la funzione Unisci
 * duplicati era di fatto inutilizzabile.
 */
function isPlaceholderEmail(email: string | null | undefined): boolean {
  return /@onizuka\.local$/i.test((email ?? "").trim());
}

/** Blocca merge se P.IVA o email contatto normalizzate risultano in conflitto tra le due anagrafiche. */
export function assertMergeClientsAllowed(
  target: Pick<Client, "vatNumber" | "contactEmail">,
  source: Pick<Client, "vatNumber" | "contactEmail">
): { ok: true } | { ok: false; error: string } {
  const tVat = normalizeVat(target.vatNumber);
  const sVat = normalizeVat(source.vatNumber);
  if (tVat && sVat && tVat !== sVat) {
    return {
      ok: false,
      error: "Merge bloccato: le due anagrafiche hanno Partita IVA diversa. Verifica prima di unire.",
    };
  }

  // Il confronto ha senso solo tra recapiti REALI: due segnaposto sono due
  // "non lo so", non due indirizzi diversi.
  const tMail = isPlaceholderEmail(target.contactEmail) ? null : normalizeEmail(target.contactEmail);
  const sMail = isPlaceholderEmail(source.contactEmail) ? null : normalizeEmail(source.contactEmail);
  if (tMail && sMail && tMail !== sMail) {
    return {
      ok: false,
      error: "Merge bloccato: email contatto principale diversa tra le due anagrafiche.",
    };
  }

  return { ok: true };
}

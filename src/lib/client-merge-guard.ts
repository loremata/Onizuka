import type { Client } from "@prisma/client";
import { normalizeEmail, normalizeVat } from "@/lib/client-dedupe";

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

  const tMail = normalizeEmail(target.contactEmail);
  const sMail = normalizeEmail(source.contactEmail);
  if (tMail && sMail && tMail !== sMail) {
    return {
      ok: false,
      error: "Merge bloccato: email contatto principale diversa tra le due anagrafiche.",
    };
  }

  return { ok: true };
}

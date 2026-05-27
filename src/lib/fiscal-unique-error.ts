import { Prisma } from "@prisma/client";

const FISCAL_INDEX_MESSAGES: Record<string, string> = {
  Client_vatNumber_norm_unique:
    "Esiste già un cliente con questa Partita IVA. Apri la scheda esistente o collega il lead.",
  Client_fiscalCode_norm_unique:
    "Esiste già un cliente con questo codice fiscale. Apri la scheda esistente o unifica da Dedupe.",
  Person_owner_fiscalCode_norm_unique:
    "Esiste già una persona con questo codice fiscale. Apri la scheda in Persone (CRM).",
};

/** True se errore Prisma P2002 su indice fiscale noto. */
export function isFiscalUniqueConstraintError(error: unknown): boolean {
  return formatFiscalUniqueViolation(error) != null;
}

/**
 * Messaggio operativo per violazione UNIQUE fiscale a livello DB.
 * Ritorna null se non è un vincolo fiscale riconosciuto.
 */
export function formatFiscalUniqueViolation(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (error.code !== "P2002") return null;

  const target = error.meta?.target;
  const parts: string[] = [];
  if (Array.isArray(target)) {
    parts.push(...target.map(String));
  } else if (typeof target === "string") {
    parts.push(target);
  }

  const haystack = [parts.join(","), error.message].join(" ");
  for (const [indexName, message] of Object.entries(FISCAL_INDEX_MESSAGES)) {
    if (haystack.includes(indexName)) return message;
  }

  if (haystack.includes("vatNumber") || haystack.includes("vat_number")) {
    return FISCAL_INDEX_MESSAGES.Client_vatNumber_norm_unique;
  }
  if (haystack.includes("fiscalCode") || haystack.includes("fiscal_code")) {
    if (haystack.includes("ownerUserId") || haystack.includes("Person")) {
      return FISCAL_INDEX_MESSAGES.Person_owner_fiscalCode_norm_unique;
    }
    return FISCAL_INDEX_MESSAGES.Client_fiscalCode_norm_unique;
  }

  return null;
}

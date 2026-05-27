import type { Client, ClientKind, ClientMacroCategory } from "@prisma/client";

/** Normalizza P.IVA italiana (rimuove IT e spazi). */
export function normalizeVatNumber(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().replace(/\s/g, "").toUpperCase();
}

/** Normalizza codice fiscale. */
export function normalizeFiscalCode(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().replace(/\s/g, "").toUpperCase();
}

/** Inferisce tipo cliente: P.IVA → azienda, solo CF → privato. */
export function inferClientKind(params: {
  vatNumber?: string | null;
  fiscalCode?: string | null;
  explicit?: ClientKind | null;
}): ClientKind {
  if (params.explicit) return params.explicit;
  const vat = normalizeVatNumber(params.vatNumber);
  const cf = normalizeFiscalCode(params.fiscalCode);
  if (vat && vat.length >= 9) return "BUSINESS";
  if (cf && cf.length >= 11) return "PRIVATE";
  return "BUSINESS";
}

export const clientKindLabel: Record<ClientKind, string> = {
  PRIVATE: "Privato",
  BUSINESS: "Azienda",
};

export const clientMacroCategoryLabel: Record<ClientMacroCategory, string> = {
  RETAIL_STORE: "Cliente negozio",
  DIGITAL_AI: "Cliente digitale / AI",
  MIXED: "Misto",
};

export function clientKindBadge(client: Pick<Client, "kind" | "vatNumber" | "fiscalCode">): ClientKind {
  return inferClientKind({
    vatNumber: client.vatNumber,
    fiscalCode: client.fiscalCode,
    explicit: client.kind,
  });
}

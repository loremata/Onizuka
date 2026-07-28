/**
 * Politica di classificazione della base giuridica per i contatti reperiti da
 * fonti pubbliche (Google Business Profile, sito aziendale, elenchi camerali).
 *
 * Principio: **non si discrimina in base al provider di posta**. Un'impresa che
 * pubblica `mario.rossi@gmail.com` sulla propria scheda Google sta pubblicando il
 * proprio recapito commerciale esattamente come chi pubblica `info@azienda.it`.
 * Escludere le caselle gratuite tagliava fuori una fetta enorme di piccole
 * attività senza aggiungere nulla sul piano della tutela.
 *
 * Resta però configurabile: `User.marketingAutoBasis` decide quale base assegnare
 * d'ufficio (o NONE per non assegnarne nessuna) e `User.marketingExcludedDomains`
 * permette di escludere domini specifici, se una valutazione legale o una scelta
 * organizzativa lo richiedesse. Di default la lista è vuota.
 */

import type { MarketingConsentBasis } from "@prisma/client";

/** Impostazioni del titolare rilevanti per la classificazione. */
export type MarketingPolicy = {
  marketingAutoBasis: MarketingConsentBasis;
  marketingExcludedDomains: string[];
};

export const DEFAULT_MARKETING_POLICY: MarketingPolicy = {
  marketingAutoBasis: "LEGITIMATE_INTEREST",
  marketingExcludedDomains: [],
};

/** Indirizzo segnaposto interno per i prospect senza contatto reale. */
const PLACEHOLDER_DOMAIN = "onizuka.local";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Dominio in minuscolo, o null se l'indirizzo non è utilizzabile. */
export function emailDomain(email: string | null | undefined): string | null {
  const clean = email?.trim().toLowerCase();
  if (!clean || !EMAIL_RE.test(clean)) return null;
  return clean.split("@")[1] ?? null;
}

/** Normalizza la lista domini scritta dall'utente ("@Gmail.com, libero.it "). */
export function parseExcludedDomains(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  for (const piece of raw.split(/[\s,;\n]+/)) {
    const d = piece.trim().toLowerCase().replace(/^@/, "");
    if (d && d.includes(".")) seen.add(d);
  }
  return Array.from(seen);
}

/**
 * Base giuridica da assegnare a un contatto appena acquisito da fonte pubblica.
 * Restituisce `NONE` quando non c'è un indirizzo utilizzabile, quando il dominio
 * è nella lista di esclusione, o quando il titolare ha scelto di non assegnare
 * nulla d'ufficio.
 */
export function resolveAutoConsentBasis(
  email: string | null | undefined,
  policy: MarketingPolicy = DEFAULT_MARKETING_POLICY
): MarketingConsentBasis {
  if (policy.marketingAutoBasis === "NONE") return "NONE";

  const domain = emailDomain(email);
  if (!domain || domain === PLACEHOLDER_DOMAIN) return "NONE";

  const excluded = policy.marketingExcludedDomains.map((d) => d.trim().toLowerCase());
  if (excluded.includes(domain)) return "NONE";

  return policy.marketingAutoBasis;
}

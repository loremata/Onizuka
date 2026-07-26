/**
 * Consenso marketing per il motore campagne cross-sell.
 *
 * Regola di contattabilità (email): un cliente è raggiungibile se ha una base
 * di marketing valida (SOFT_OPT_IN o EXPLICIT) e NON si è disiscritto.
 * `marketingConsentBasis === 'NONE'` oppure `marketingOptOutAt` valorizzato ⇒
 * NON contattabile.
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import type { MarketingConsentBasis } from "@prisma/client";

/** Campi minimi necessari per valutare la contattabilità. */
export type EmailableClient = {
  marketingConsentBasis: MarketingConsentBasis;
  marketingOptOutAt: Date | null;
};

/** True se il cliente può ricevere email marketing (base valida + nessun opt-out). */
export function isEmailable(client: EmailableClient): boolean {
  return client.marketingConsentBasis !== "NONE" && client.marketingOptOutAt == null;
}

/** Genera un token opt-out opaco (url-safe) per il link di disiscrizione. */
export function generateOptOutToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Garantisce che il cliente abbia un `marketingOptOutToken`: se manca lo genera
 * e lo salva. Idempotente: se già presente lo restituisce senza riscrivere.
 * Ritorna il token corrente.
 */
export async function ensureClientOptOutToken(clientId: string): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { marketingOptOutToken: true },
  });
  if (!client) throw new Error("Cliente non trovato.");
  if (client.marketingOptOutToken) return client.marketingOptOutToken;

  const token = generateOptOutToken();
  await prisma.client.update({
    where: { id: clientId },
    data: { marketingOptOutToken: token },
  });
  return token;
}

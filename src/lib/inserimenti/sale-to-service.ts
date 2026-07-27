/**
 * PONTE vendita al banco → possesso commerciale del cliente.
 *
 * NON è logica compensi (quella vive in engine.ts e non va toccata): qui si
 * traduce la "pista" di una vendita registrata (StoreSale) nel possesso che il
 * cliente maturerebbe sulla sua scheda CRM — un contratto retail
 * (ClientRetailContract) oppure un servizio del catalogo (ClientCommercialService).
 *
 * I lineKey reali arrivano dal seed dei piani (plan-luglio-2026.ts):
 *   TIM      → MNP, AL_PP, ACCESSO_FISSO, CONTENUTI, TIMFIN, ENERGIA,
 *              TELEPASS_FAMILY, TIM_UNICA
 *   FASTWEB  → MOBILE, TEL_INC, FISSO, ENERGIA, FISSO_BUSINESS,
 *              MOBILE_BUSINESS, ENERGIA_BUSINESS
 *   ENEL     → ENERGIA, ENERGIA_DUAL
 *   ENI      → TELEPASS
 *   ILIAD    → MNP
 *
 * Funzione PURA: nessun accesso al DB, così è testabile e riusabile.
 */

import type { RetailContractKind } from "@prisma/client";

export interface SaleOwnershipInput {
  brand: string;
  lineKey: string;
  subtype?: string | null;
}

/** Possesso derivato: al più uno tra contratto retail e servizio catalogo. */
export interface SaleOwnership {
  retailKind?: RetailContractKind;
  serviceSlug?: string;
}

/**
 * Mappa la pista di vendita al possesso cliente.
 * Ritorna null quando la vendita non corrisponde a un possesso attivabile
 * (es. rate/finanziamento TIMFIN o TEL_INC, bundle TIM Unica, extra vari):
 * in quei casi la vendita resta SOLO compenso, senza attivare nulla sul CRM.
 */
export function mapStoreSaleToOwnership(sale: SaleOwnershipInput): SaleOwnership | null {
  const line = (sale.lineKey || "").trim().toUpperCase();
  const subtype = (sale.subtype || "").trim().toUpperCase();
  if (!line) return null;

  // Contenuti / TIMVision / TV → servizio commerciale del catalogo ("tim-vision").
  if (line === "CONTENUTI" || line === "TV" || line.includes("VISION")) {
    return { serviceSlug: "tim-vision" };
  }

  // Mobile: MNP (portabilità), AL/AL_PP (nuove attivazioni), MOBILE/MOBILE_BUSINESS.
  if (line === "MNP" || line.startsWith("AL") || line === "MOBILE" || line === "MOBILE_BUSINESS") {
    return { retailKind: "MOBILE" };
  }

  // Fisso / FWA → connettività (FIBER nel catalogo retail).
  if (line.includes("FISSO") || line.includes("FWA")) {
    return { retailKind: "FIBER" };
  }

  // Telepass (TELEPASS, TELEPASS_FAMILY…).
  if (line.includes("TELEPASS")) {
    return { retailKind: "TELEPASS" };
  }

  // Energia: il lineKey NON distingue luce da gas (ENERGIA / ENERGIA_DUAL /
  // ENERGIA_BUSINESS coprono entrambi). Default luce (ENERGY); GAS solo se il
  // sottotipo lo indica esplicitamente. Il dual si registra come due vendite,
  // ciascuna mappata qui.
  if (line.includes("ENERGIA") || line.includes("ENERGY") || line === "LUCE") {
    if (subtype.includes("GAS")) return { retailKind: "GAS" };
    return { retailKind: "ENERGY" };
  }
  if (line === "GAS") return { retailKind: "GAS" };

  // Non mappabile: TIMFIN, TEL_INC (finanziamenti telefono), TIM_UNICA
  // (convergenza, non un possesso a sé), extra vari → nessuna attivazione.
  return null;
}

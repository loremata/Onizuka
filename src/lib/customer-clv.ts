/**
 * CLV (Customer Lifetime Value) semplificato sul margine netto.
 *
 * Modulo PURO (nessun accesso DB):
 * - `realizedEur`: valore già generato = opportunità WON + provvigioni one-shot
 *   dei contratti retail attivi (i contratti retail non passano dalle
 *   opportunità, quindi non sono già dentro `wonValueEur`).
 * - `futureEur`: proiezione dei servizi ricorrenti attivi sul residuo di
 *   retention della categoria (RETENTION_MONTHS_BY_CATEGORY).
 * - `potentialEur`: realized + future + valore atteso della pipeline.
 */

import {
  RETENTION_MONTHS_BY_CATEGORY,
  SERVICE_CATEGORY_BY_SLUG,
  SERVICE_ECONOMICS,
} from "@/lib/customer-value-config";
import { RETAIL_KIND_TO_SLUG } from "@/lib/customer-pipeline";

export type CustomerClvInput = {
  /** Somma estimatedValue delle opportunità WON (€). */
  wonValueEur: number;
  /** Contratti retail ACTIVE del cliente. */
  retailContracts: Array<{ kind: string; monthlyEur: number; signedAt: Date | null }>;
  /** ClientCommercialService attivi con economics `monthly` (slug + since). */
  activeMonthlyServices: Array<{ slug: string; since: Date | null }>;
  /** Somma expectedValueEur della pipeline calcolata. */
  pipelineExpectedTotal: number;
  /** Data di riferimento (default: ora) — utile per test deterministici. */
  now?: Date;
};

export type CustomerClv = {
  realizedEur: number;
  futureEur: number;
  potentialEur: number;
};

function monthsBetween(from: Date | null, to: Date): number {
  if (!from) return 0;
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 30)));
}

export function computeCustomerClv(input: CustomerClvInput): CustomerClv {
  const now = input.now ?? new Date();

  // Realizzato: WON + provvigione one-shot per ogni contratto retail attivo.
  let realizedEur = input.wonValueEur;
  for (const contract of input.retailContracts) {
    const slug = RETAIL_KIND_TO_SLUG[contract.kind];
    const eco = slug ? SERVICE_ECONOMICS[slug] : undefined;
    if (eco && eco.recurrence === "one_shot") realizedEur += eco.netUnitEur;
  }

  // Futuro: servizi ricorrenti attivi × mesi residui di retention della categoria.
  let futureEur = 0;
  for (const svc of input.activeMonthlyServices) {
    const eco = SERVICE_ECONOMICS[svc.slug];
    if (!eco || eco.recurrence !== "monthly") continue;
    const category = SERVICE_CATEGORY_BY_SLUG[svc.slug] ?? "OTHER";
    const retention = RETENTION_MONTHS_BY_CATEGORY[category] ?? 12;
    const elapsed = monthsBetween(svc.since, now);
    futureEur += eco.netUnitEur * Math.max(0, retention - elapsed);
  }

  const realized = Math.round(realizedEur);
  const future = Math.round(futureEur);
  return {
    realizedEur: realized,
    futureEur: future,
    potentialEur: realized + future + Math.round(input.pipelineExpectedTotal),
  };
}

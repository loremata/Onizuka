/**
 * Valori di margine netto per servizio (da FONTE-UNICA / app Customer Scoring).
 * Modificabili a mano.
 *
 * - `netUnitEur`: margine netto unitario (€). Per `recurrence: "monthly"` è il
 *   margine mensile; per `"one_shot"` è il margine una tantum.
 * - `estimate: true` marca i valori stimati (non ancora consolidati a listino).
 */

export type ServiceRecurrence = "one_shot" | "monthly";

export type ServiceEconomics = {
  netUnitEur: number;
  recurrence: ServiceRecurrence;
  estimate?: boolean;
};

export const SERVICE_ECONOMICS: Record<string, ServiceEconomics> = {
  // Telecom / utility (provvigioni retail)
  mobile: { netUnitEur: 10, recurrence: "one_shot" },
  sim: { netUnitEur: 10, recurrence: "one_shot" },
  fiber: { netUnitEur: 10, recurrence: "one_shot" },
  fwa: { netUnitEur: 10, recurrence: "one_shot" },
  energy: { netUnitEur: 10, recurrence: "one_shot" },
  gas: { netUnitEur: 10, recurrence: "one_shot" },
  sky: { netUnitEur: 10, recurrence: "one_shot" },
  telepass: { netUnitEur: 1, recurrence: "one_shot" },
  "tim-vision": { netUnitEur: 5, recurrence: "one_shot", estimate: true },
  streaming: { netUnitEur: 5, recurrence: "one_shot", estimate: true },
  tv: { netUnitEur: 5, recurrence: "one_shot", estimate: true },
  pbx: { netUnitEur: 10, recurrence: "one_shot", estimate: true },
  // Web
  website: { netUnitEur: 599, recurrence: "one_shot" },
  ecommerce: { netUnitEur: 1199, recurrence: "one_shot" },
  hosting: { netUnitEur: 10, recurrence: "monthly", estimate: true },
  domain: { netUnitEur: 3, recurrence: "monthly", estimate: true },
  maintenance: { netUnitEur: 25, recurrence: "monthly", estimate: true },
  // Marketing
  seo: { netUnitEur: 112, recurrence: "monthly" },
  "google-ads": { netUnitEur: 119, recurrence: "monthly" },
  "meta-ads": { netUnitEur: 119, recurrence: "monthly" },
  "landing-page": { netUnitEur: 232, recurrence: "one_shot" },
  "social-mgmt": { netUnitEur: 69, recurrence: "monthly" },
  // Branding / AI / consulenza
  branding: { netUnitEur: 668, recurrence: "one_shot" },
  automations: { netUnitEur: 488, recurrence: "monthly" },
  "ai-consulting": { netUnitEur: 441, recurrence: "one_shot" },
  "digital-audit": { netUnitEur: 262, recurrence: "one_shot" },
  consulting: { netUnitEur: 441, recurrence: "one_shot" },
};

/**
 * Mesi di retention attesa per categoria di servizio: quanto a lungo, in media,
 * un servizio ricorrente resta attivo (usata per proiettare il valore futuro).
 */
export const RETENTION_MONTHS_BY_CATEGORY: Record<string, number> = {
  TELECOM: 24,
  ENERGY: 24,
  MARKETING: 12,
  AUTOMATION: 12,
  BRANDING: 12,
  CONSULTING: 12,
  WEB: 0,
  OTHER: 12,
};

/** Orizzonte pipeline (mesi) per annualizzare i servizi ricorrenti. */
export const PIPELINE_HORIZON_MONTHS = 12;

/** Tetto massimo alla probabilità di chiusura di una singola opportunità. */
export const PROBABILITY_CAP = 0.85;

/**
 * Categoria per slug (allineata al catalogo `commercial-catalog-seed.ts`).
 * Tenuta qui, senza dipendenze DB, per poter usare motore e CLV in modo puro.
 */
export const SERVICE_CATEGORY_BY_SLUG: Record<string, string> = {
  mobile: "TELECOM",
  sim: "TELECOM",
  fiber: "TELECOM",
  fwa: "TELECOM",
  sky: "TELECOM",
  "tim-vision": "TELECOM",
  streaming: "TELECOM",
  tv: "TELECOM",
  pbx: "TELECOM",
  telepass: "TELECOM",
  energy: "ENERGY",
  gas: "ENERGY",
  website: "WEB",
  hosting: "WEB",
  domain: "WEB",
  maintenance: "WEB",
  ecommerce: "WEB",
  seo: "MARKETING",
  "google-ads": "MARKETING",
  "meta-ads": "MARKETING",
  "landing-page": "MARKETING",
  "social-mgmt": "MARKETING",
  branding: "BRANDING",
  automations: "AUTOMATION",
  "ai-consulting": "CONSULTING",
  "digital-audit": "CONSULTING",
  consulting: "CONSULTING",
};

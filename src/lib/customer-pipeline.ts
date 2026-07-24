/**
 * Motore pipeline up/cross-sell (portato dall'app standalone "Customer Scoring").
 *
 * Modulo PURO: nessun accesso a DB. Dati economici e probabilità in
 * `customer-value-config.ts`. Regola generale: si parte da ciò che il cliente
 * HA GIÀ attivo e si propongono i servizi complementari, con probabilità base
 * più eventuali boost (profilo business, score, macro-categoria).
 *
 * I rationale descrivono COSA aggiunge il servizio e PER CHI/QUANDO ha senso:
 * mai confronti di merito tra servizi dell'ecosistema.
 */

import type { ClientMacroCategory } from "@prisma/client";
import {
  PIPELINE_HORIZON_MONTHS,
  PROBABILITY_CAP,
  SERVICE_CATEGORY_BY_SLUG,
  SERVICE_ECONOMICS,
} from "@/lib/customer-value-config";

export type CustomerOpportunity = {
  serviceSlug: string;
  name: string;
  /** Probabilità di chiusura stimata (0-1, cap `PROBABILITY_CAP`). */
  probability: number;
  /** Margine netto annualizzato del servizio (€, orizzonte 12 mesi). */
  netAnnualizedEur: number;
  /** Valore atteso = netAnnualized × probability (arrotondato). */
  expectedValueEur: number;
  /** Motivazione in italiano (tono positivo, differenzia su cosa/quando/per chi). */
  rationale: string;
  kind: "cross-sell" | "up-sell";
};

export type CustomerPipelineInput = {
  /** Slug dei servizi già attivi (ClientCommercialService active + contratti retail mappati). */
  ownedServiceSlugs: Set<string>;
  isBusiness: boolean;
  macroCategory: ClientMacroCategory | null;
  /** Customer score 0-100 (computeCustomerScore). */
  score: number;
};

/** Mapping contratto retail → slug catalogo (per costruire ownedServiceSlugs). */
export const RETAIL_KIND_TO_SLUG: Record<string, string> = {
  MOBILE: "mobile",
  FIBER: "fiber",
  ENERGY: "energy",
  GAS: "gas",
  SKY: "sky",
  TELEPASS: "telepass",
};

/** Nomi servizio per slug (allineati al catalogo seminato). */
const SERVICE_NAME_BY_SLUG: Record<string, string> = {
  mobile: "Telefonia mobile",
  sim: "SIM",
  fiber: "Fibra / connettività",
  fwa: "FWA",
  energy: "Energia / luce",
  gas: "Gas",
  sky: "Sky / pay TV",
  telepass: "Telepass",
  "tim-vision": "TIM Vision",
  streaming: "Streaming",
  tv: "TV",
  pbx: "Centralino",
  website: "Sito web",
  hosting: "Hosting",
  domain: "Dominio",
  maintenance: "Manutenzione ricorrente",
  seo: "SEO",
  "google-ads": "Google Ads",
  "meta-ads": "Meta Ads",
  "landing-page": "Landing page",
  "social-mgmt": "Social media management",
  ecommerce: "E-commerce",
  branding: "Branding",
  automations: "Automazioni",
  "ai-consulting": "AI consulting",
  "digital-audit": "Audit digitale",
  consulting: "Consulenza digitale",
};

const DIGITAL_CATEGORIES = new Set(["WEB", "MARKETING", "BRANDING"]);

function categoryOf(slug: string): string {
  return SERVICE_CATEGORY_BY_SLUG[slug] ?? "OTHER";
}

function hasAny(owned: Set<string>, slugs: string[]): boolean {
  return slugs.some((s) => owned.has(s));
}

function hasCategory(owned: Set<string>, category: string): boolean {
  for (const slug of Array.from(owned)) {
    if (categoryOf(slug) === category) return true;
  }
  return false;
}

/** Annualizza il margine netto sull'orizzonte pipeline (12 mesi). */
export function netAnnualizedEurOf(slug: string): number {
  const eco = SERVICE_ECONOMICS[slug];
  if (!eco) return 0;
  return eco.recurrence === "monthly" ? eco.netUnitEur * PIPELINE_HORIZON_MONTHS : eco.netUnitEur;
}

type Proposal = {
  slug: string;
  probability: number;
  rationale: string;
  kind?: "cross-sell" | "up-sell";
};

/**
 * Calcola le opportunità up/cross-sell per un cliente a partire da ciò che ha.
 * Dedup per slug (probabilità massima), cap a `PROBABILITY_CAP`, ordinamento
 * per valore atteso decrescente.
 */
export function computeCustomerPipeline(input: CustomerPipelineInput): CustomerOpportunity[] {
  const owned = input.ownedServiceSlugs;
  const { isBusiness, macroCategory, score } = input;
  const proposals: Proposal[] = [];

  const hasTelco = hasCategory(owned, "TELECOM");
  const hasEnergyCat = hasCategory(owned, "ENERGY");
  const hasDigital =
    hasCategory(owned, "WEB") || hasCategory(owned, "MARKETING") || hasCategory(owned, "BRANDING");

  // --- Telco: mobile ↔ fibra ---
  if (hasAny(owned, ["mobile", "sim"])) {
    proposals.push({
      slug: "fiber",
      probability: 0.5,
      rationale: "Ha già il mobile con noi: la fibra completa la connettività di casa o dell'attività con un unico referente.",
    });
  }
  if (hasAny(owned, ["fiber", "fwa"])) {
    proposals.push({
      slug: "mobile",
      probability: 0.45,
      rationale: "Ha già la connettività fissa: una linea mobile abbinata semplifica gestione e fatturazione.",
    });
  }

  // --- Energia / gas ---
  if (!owned.has("energy") && (hasTelco || owned.has("gas"))) {
    let p = owned.has("gas") ? 0.55 : 0.4;
    if (score >= 55) p += 0.15;
    proposals.push({
      slug: "energy",
      probability: p,
      rationale: owned.has("gas")
        ? "Ha già il gas: aggiungere la luce riunisce le utenze in un unico punto di gestione."
        : "Cliente telco consolidato: la fornitura luce è il passo naturale per gestire tutto da un unico referente.",
    });
  }
  if (!owned.has("gas") && (owned.has("energy") || hasTelco)) {
    let p = owned.has("energy") ? 0.55 : 0.4;
    if (score >= 55) p += 0.15;
    proposals.push({
      slug: "gas",
      probability: p,
      rationale: owned.has("energy")
        ? "Ha già la luce: aggiungere il gas riunisce le utenze in un unico punto di gestione."
        : "Cliente telco consolidato: la fornitura gas è il passo naturale per gestire tutto da un unico referente.",
    });
  }

  // --- Telepass / Sky su base telco-energia ---
  if (hasTelco || hasEnergyCat) {
    proposals.push({
      slug: "telepass",
      probability: 0.2 + (isBusiness ? 0.1 : 0),
      rationale: isBusiness
        ? "Per chi si sposta per lavoro: Telepass aggiunge comodità quotidiana con attivazione rapida in negozio."
        : "Telepass aggiunge comodità quotidiana negli spostamenti, con attivazione rapida in negozio.",
    });
    proposals.push({
      slug: "sky",
      probability: 0.15 + (!isBusiness ? 0.1 : 0),
      rationale: "Per il tempo libero in famiglia: Sky completa l'offerta di casa con intrattenimento e sport.",
    });
  }

  // --- Digitale: dal sito ai canali di visibilità ---
  if (hasAny(owned, ["website", "ecommerce"])) {
    proposals.push({
      slug: "seo",
      probability: 0.45,
      rationale: "Il sito è già online: la SEO lo rende trovabile da chi cerca proprio questi prodotti o servizi.",
    });
    proposals.push({
      slug: "social-mgmt",
      probability: 0.4,
      rationale: "Con il sito attivo, i social danno continuità alla presenza online e tengono vivo il contatto con i clienti.",
    });
  }
  if (owned.has("website") && owned.has("social-mgmt")) {
    proposals.push({
      slug: "meta-ads",
      probability: 0.4,
      rationale: "Sito e social sono già attivi: le campagne Meta amplificano ciò che il pubblico locale già segue.",
    });
    proposals.push({
      slug: "google-ads",
      probability: 0.35,
      rationale: "Sito e social sono già attivi: Google Ads intercetta chi sta cercando attivamente in zona.",
    });
  }

  // --- Branding su base web/social ---
  if (hasCategory(owned, "WEB") || owned.has("social-mgmt")) {
    proposals.push({
      slug: "branding",
      probability: 0.25 + (isBusiness ? 0.15 : 0),
      rationale: "La presenza online c'è: un'identità visiva coerente la rende riconoscibile su ogni canale.",
    });
  }

  // --- Automazioni per business già digitali ---
  if (hasDigital && isBusiness) {
    const macroBoost = macroCategory === "DIGITAL_AI" || macroCategory === "MIXED" ? 0.15 : 0;
    proposals.push({
      slug: "automations",
      probability: 0.25 + macroBoost,
      rationale: "Ha già asset digitali attivi: le automazioni fanno lavorare quegli asset anche quando il team è occupato altrove.",
    });
  }

  // --- Consulenza per clienti ad alto score ---
  if (score >= 70 && isBusiness) {
    proposals.push({
      slug: "consulting",
      probability: 0.2,
      rationale: "Cliente con relazione solida: una consulenza dedicata aiuta a pianificare i prossimi passi digitali.",
    });
    proposals.push({
      slug: "digital-audit",
      probability: 0.2,
      rationale: "Cliente con relazione solida: l'audit digitale fotografa la presenza online e indica dove agire per primi.",
    });
  }

  // --- Primo passo digitale per clienti solo telco/energia ---
  if ((hasTelco || hasEnergyCat) && !hasDigital) {
    proposals.push({
      slug: "website",
      probability: 0.15 + (isBusiness ? 0.1 : 0),
      kind: "cross-sell",
      rationale: "Cliente di fiducia in negozio: il sito è il primo passo per portare l'attività online e farsi trovare anche fuori zona.",
    });
  }

  // Dedup per slug (probabilità massima), salta i servizi già posseduti.
  const bySlug = new Map<string, Proposal>();
  for (const p of proposals) {
    if (owned.has(p.slug)) continue;
    const prev = bySlug.get(p.slug);
    if (!prev || p.probability > prev.probability) bySlug.set(p.slug, p);
  }

  const out: CustomerOpportunity[] = [];
  for (const p of Array.from(bySlug.values())) {
    const probability = Math.min(PROBABILITY_CAP, p.probability);
    const netAnnualizedEur = netAnnualizedEurOf(p.slug);
    // Up-sell se il cliente ha già servizi nella stessa categoria, cross-sell altrimenti.
    const kind: "cross-sell" | "up-sell" =
      p.kind ?? (hasCategory(owned, categoryOf(p.slug)) ? "up-sell" : "cross-sell");
    out.push({
      serviceSlug: p.slug,
      name: SERVICE_NAME_BY_SLUG[p.slug] ?? p.slug,
      probability,
      netAnnualizedEur,
      expectedValueEur: Math.round(netAnnualizedEur * probability),
      rationale: p.rationale,
      kind,
    });
  }

  out.sort((a, b) => b.expectedValueEur - a.expectedValueEur || b.probability - a.probability);
  return out;
}

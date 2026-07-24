import type { CommercialServiceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CatalogBrandSeed = {
  slug: string;
  name: string;
  domain?: string;
  mission?: string;
  positioning?: string;
  sortOrder: number;
};

export type CatalogServiceSeed = {
  slug: string;
  name: string;
  category: CommercialServiceCategory;
  brandSlug?: string;
  description?: string;
  sortOrder: number;
};

export const ECOSYSTEM_BRANDS: CatalogBrandSeed[] = [
  {
    slug: "online-station",
    name: "Online Station",
    domain: "onlinestation.it",
    mission: "Telecomunicazioni, connettività ed energia per imprese e retail.",
    positioning: "Partner utility e connettività B2B/B2C.",
    sortOrder: 10,
  },
  {
    slug: "labseven",
    name: "LabSeven",
    domain: "labseven.it",
    mission: "Siti web, UX e performance digitale.",
    positioning: "Web agency tecnica orientata a conversione.",
    sortOrder: 20,
  },
  {
    slug: "studiopop",
    name: "StudioPop",
    domain: "studiopop.it",
    mission: "Social media, content e ADV Meta.",
    positioning: "Presenza social e advertising social-first.",
    sortOrder: 30,
  },
  {
    slug: "doctorlead",
    name: "DoctorLead",
    domain: "doctorlead.it",
    mission: "Lead generation, landing e Google Ads.",
    positioning: "Traffico qualificato e conversione.",
    sortOrder: 40,
  },
  {
    slug: "brandity",
    name: "Brandity",
    domain: "brandity.it",
    mission: "Branding e identità visiva.",
    positioning: "Immagine coerente e differenziazione.",
    sortOrder: 50,
  },
  {
    slug: "vaultai",
    name: "VaultAI",
    domain: "vaultai.it",
    mission: "AI, automazioni e sistemi intelligenti per negozi, PMI e aziende.",
    positioning: "Linea AI commerciale Online Station (capability da Onizuka).",
    sortOrder: 60,
  },
  {
    slug: "sito24ore",
    name: "Sito24Ore",
    domain: "sito24ore.it",
    mission: "Siti veloci e manutenzione ricorrente.",
    positioning: "Presenza web rapida e ricorrente.",
    sortOrder: 70,
  },
  {
    slug: "lorenzo-matarazzo",
    name: "LorenzoMatarazzo.it",
    domain: "lorenzomatarazzo.it",
    mission: "Personal brand e consulenza strategica.",
    positioning: "Hub personale e advisory.",
    sortOrder: 80,
  },
];

/** Template email proposta per brand (PUNTO-SITUA §18.1). */
export const BRAND_PROPOSAL_TEMPLATES: Record<
  string,
  { subject: string; body: string }
> = {
  labseven: {
    subject: "Proposta LabSeven per {{companyName}}",
    body: "Buongiorno,\n\nin allegato la proposta LabSeven (sito, SEO, performance).\n\n{{companyName}}\n\nLorenzo Matarazzo · Online Station",
  },
  studiopop: {
    subject: "Proposta StudioPop · social e ADV per {{companyName}}",
    body: "Buongiorno,\n\npropongo un piano social e campagne Meta allineate al vostro brand.\n\nCordiali saluti,\nLorenzo",
  },
  doctorlead: {
    subject: "DoctorLead · lead generation per {{companyName}}",
    body: "Buongiorno,\n\necco la proposta performance (Google/Meta) per generare lead qualificati.\n\nLorenzo Matarazzo",
  },
  brandity: {
    subject: "Brandity · identità per {{companyName}}",
    body: "Buongiorno,\n\nproposta branding e posizionamento su misura.\n\nLorenzo",
  },
  vaultai: {
    subject: "VaultAI · automazioni per {{companyName}}",
    body: "Buongiorno,\n\npropongo automazioni e assistenti AI per vendite e amministrazione.\n\nVaultAI · Online Station",
  },
  "sito24ore": {
    subject: "Sito24Ore · presenza web rapida per {{companyName}}",
    body: "Buongiorno,\n\nproposta sito veloce + manutenzione ricorrente.\n\nLorenzo",
  },
  "online-station": {
    subject: "Online Station · servizi per {{companyName}}",
    body: "Buongiorno,\n\nproposta servizi telecom/utility e digitale.\n\nOnline Station",
  },
  "lorenzo-matarazzo": {
    subject: "Consulenza · {{companyName}}",
    body: "Buongiorno,\n\npropongo un confronto strategico su priorità digitali e retail.\n\nLorenzo Matarazzo",
  },
};

export const COMMERCIAL_SERVICES: CatalogServiceSeed[] = [
  { slug: "mobile", name: "Telefonia mobile", category: "TELECOM", brandSlug: "online-station", sortOrder: 10 },
  { slug: "sim", name: "SIM", category: "TELECOM", brandSlug: "online-station", sortOrder: 15 },
  { slug: "fiber", name: "Fibra / connettività", category: "TELECOM", brandSlug: "online-station", sortOrder: 20 },
  { slug: "fwa", name: "FWA", category: "TELECOM", brandSlug: "online-station", sortOrder: 25 },
  { slug: "energy", name: "Energia / luce", category: "ENERGY", brandSlug: "online-station", sortOrder: 30 },
  { slug: "gas", name: "Gas", category: "ENERGY", brandSlug: "online-station", sortOrder: 35 },
  { slug: "sky", name: "Sky / pay TV", category: "TELECOM", brandSlug: "online-station", sortOrder: 40 },
  { slug: "telepass", name: "Telepass", category: "TELECOM", brandSlug: "online-station", sortOrder: 42 },
  { slug: "tim-vision", name: "TIM Vision", category: "TELECOM", brandSlug: "online-station", sortOrder: 45 },
  { slug: "streaming", name: "Streaming", category: "TELECOM", brandSlug: "online-station", sortOrder: 48 },
  { slug: "tv", name: "TV", category: "TELECOM", brandSlug: "online-station", sortOrder: 49 },
  { slug: "website", name: "Sito web", category: "WEB", brandSlug: "labseven", sortOrder: 50 },
  { slug: "hosting", name: "Hosting", category: "WEB", brandSlug: "sito24ore", sortOrder: 60 },
  { slug: "domain", name: "Dominio", category: "WEB", brandSlug: "sito24ore", sortOrder: 70 },
  { slug: "maintenance", name: "Manutenzione ricorrente", category: "WEB", brandSlug: "sito24ore", sortOrder: 80 },
  { slug: "seo", name: "SEO", category: "MARKETING", brandSlug: "labseven", sortOrder: 90 },
  { slug: "google-ads", name: "Google Ads", category: "MARKETING", brandSlug: "doctorlead", sortOrder: 100 },
  { slug: "meta-ads", name: "Meta Ads", category: "MARKETING", brandSlug: "studiopop", sortOrder: 110 },
  { slug: "landing-page", name: "Landing page", category: "MARKETING", brandSlug: "doctorlead", sortOrder: 115 },
  { slug: "social-mgmt", name: "Social media management", category: "MARKETING", brandSlug: "studiopop", sortOrder: 120 },
  { slug: "ecommerce", name: "E-commerce", category: "WEB", brandSlug: "labseven", sortOrder: 125 },
  { slug: "branding", name: "Branding", category: "BRANDING", brandSlug: "brandity", sortOrder: 130 },
  { slug: "automations", name: "Automazioni", category: "AUTOMATION", brandSlug: "vaultai", sortOrder: 140 },
  { slug: "ai-consulting", name: "AI consulting", category: "CONSULTING", brandSlug: "vaultai", sortOrder: 150 },
  { slug: "pbx", name: "Centralino", category: "TELECOM", brandSlug: "online-station", sortOrder: 160 },
  { slug: "digital-audit", name: "Audit digitale", category: "CONSULTING", sortOrder: 170 },
  { slug: "consulting", name: "Consulenza digitale", category: "CONSULTING", sortOrder: 180 },
];

/** Idempotente: popola brand e catalogo servizi se assenti. */
export async function seedCommercialCatalog(): Promise<{ brands: number; services: number }> {
  const brandIdBySlug = new Map<string, string>();

  for (const b of ECOSYSTEM_BRANDS) {
    const tpl = BRAND_PROPOSAL_TEMPLATES[b.slug];
    const row = await prisma.ecosystemBrand.upsert({
      where: { slug: b.slug },
      update: {
        name: b.name,
        domain: b.domain,
        mission: b.mission,
        positioning: b.positioning,
        sortOrder: b.sortOrder,
        proposalEmailSubjectTemplate: tpl?.subject,
        proposalEmailBodyTemplate: tpl?.body,
      },
      create: {
        slug: b.slug,
        name: b.name,
        domain: b.domain,
        mission: b.mission,
        positioning: b.positioning,
        sortOrder: b.sortOrder,
        proposalEmailSubjectTemplate: tpl?.subject,
        proposalEmailBodyTemplate: tpl?.body,
      },
    });
    brandIdBySlug.set(b.slug, row.id);
  }

  for (const s of COMMERCIAL_SERVICES) {
    const ecosystemBrandId = s.brandSlug ? brandIdBySlug.get(s.brandSlug) : undefined;
    await prisma.commercialService.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        category: s.category,
        description: s.description,
        sortOrder: s.sortOrder,
        ecosystemBrandId: ecosystemBrandId ?? null,
      },
      create: {
        slug: s.slug,
        name: s.name,
        category: s.category,
        description: s.description,
        sortOrder: s.sortOrder,
        ecosystemBrandId,
      },
    });
  }

  return {
    brands: ECOSYSTEM_BRANDS.length,
    services: COMMERCIAL_SERVICES.length,
  };
}

/**
 * Versione per l'hot-path (render scheda): NON ri-semina a ogni caricamento.
 * Fa un solo `count` economico e popola solo se il catalogo è incompleto/vuoto.
 * Evita le ~34 scritture sequenziali che rallentavano ogni apertura di scheda.
 */
export async function ensureCommercialCatalogSeeded(): Promise<{ seeded: boolean }> {
  const count = await prisma.commercialService.count();
  if (count >= COMMERCIAL_SERVICES.length) return { seeded: false };
  await seedCommercialCatalog();
  return { seeded: true };
}

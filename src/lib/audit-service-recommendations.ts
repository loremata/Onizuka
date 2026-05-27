import type { DigitalAuditSectionKey } from "@prisma/client";

export type AuditServiceRecommendation = {
  sectionKey: DigitalAuditSectionKey;
  priorityProblem: string;
  brandSlug: string;
  serviceSlug: string;
  serviceLabel: string;
  commercialPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

/** Mappa centralizzata criticità audit → servizio commerciale. */
export const AUDIT_SECTION_RECOMMENDATIONS: Record<
  DigitalAuditSectionKey,
  Omit<AuditServiceRecommendation, "sectionKey">
> = {
  WEBSITE: {
    priorityProblem: "Sito assente o non orientato al business",
    brandSlug: "labseven",
    serviceSlug: "website",
    serviceLabel: "Sito web / presenza online",
    commercialPriority: "URGENT",
  },
  SEO: {
    priorityProblem: "Visibilità organica insufficiente",
    brandSlug: "labseven",
    serviceSlug: "seo",
    serviceLabel: "SEO base / audit SEO",
    commercialPriority: "HIGH",
  },
  LOCAL: {
    priorityProblem: "Google Business Profile da ottimizzare",
    brandSlug: "labseven",
    serviceSlug: "seo",
    serviceLabel: "Local SEO / gestione GBP",
    commercialPriority: "HIGH",
  },
  REVIEWS: {
    priorityProblem: "Recensioni e reputazione locali deboli",
    brandSlug: "labseven",
    serviceSlug: "seo",
    serviceLabel: "Gestione recensioni GBP",
    commercialPriority: "MEDIUM",
  },
  SOCIAL: {
    priorityProblem: "Presenza social debole o incoerente",
    brandSlug: "studiopop",
    serviceSlug: "social-mgmt",
    serviceLabel: "Social media starter / StudioPop",
    commercialPriority: "MEDIUM",
  },
  ADV: {
    priorityProblem: "Assenza campagne paid strutturate",
    brandSlug: "doctorlead",
    serviceSlug: "google-ads",
    serviceLabel: "Google Ads / Meta Ads",
    commercialPriority: "HIGH",
  },
  UX: {
    priorityProblem: "Esperienza utente da migliorare",
    brandSlug: "labseven",
    serviceSlug: "website",
    serviceLabel: "Restyling sito / UX",
    commercialPriority: "MEDIUM",
  },
  CONVERSION: {
    priorityProblem: "Traffico o sito senza conversione adeguata",
    brandSlug: "doctorlead",
    serviceSlug: "google-ads",
    serviceLabel: "Landing + campagne / DoctorLead",
    commercialPriority: "HIGH",
  },
  TRACKING: {
    priorityProblem: "Tracciamento e analytics assenti",
    brandSlug: "labseven",
    serviceSlug: "consulting",
    serviceLabel: "Setup analytics / consulenza digitale",
    commercialPriority: "MEDIUM",
  },
  BRAND: {
    priorityProblem: "Immagine e posizionamento poco chiari",
    brandSlug: "brandity",
    serviceSlug: "branding",
    serviceLabel: "Branding / posizionamento",
    commercialPriority: "MEDIUM",
  },
};

export function pickAuditRecommendationFromSections(
  sections: { sectionKey: DigitalAuditSectionKey; score: number }[]
): AuditServiceRecommendation {
  const weakest = [...sections].sort((a, b) => a.score - b.score)[0];
  const base = AUDIT_SECTION_RECOMMENDATIONS[weakest.sectionKey];
  return { sectionKey: weakest.sectionKey, ...base };
}

export function commercialPriorityFromAuditScore(score: number): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  if (score < 35) return "URGENT";
  if (score < 50) return "HIGH";
  if (score < 65) return "MEDIUM";
  return "LOW";
}

export function estimatedValueHintFromScore(score: number): string {
  if (score < 35) return "Alto potenziale (presenza digitale critica)";
  if (score < 55) return "Medio-alto (gap evidenti da colmare)";
  if (score < 70) return "Medio (miglioramenti mirati)";
  return "Qualificato (affinamento e upsell)";
}

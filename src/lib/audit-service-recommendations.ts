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

export type AuditFinding = { gap: string; consequence: string; solution: string };

/**
 * Copy lato cliente per ogni sezione audit: lacuna → conseguenza di business → soluzione generica.
 * NESSUN nome di prodotto/brand interno (il prospect non li conosce): linguaggio semplice e diretto.
 */
export const AUDIT_SECTION_CLIENT_COPY: Record<
  DigitalAuditSectionKey,
  { gap: string; consequence: string; solution: string }
> = {
  WEBSITE: {
    gap: "il sito web è assente o poco orientato a generare contatti",
    consequence: "chi vi cerca online non trova un riferimento credibile e si rivolge ai concorrenti",
    solution: "un sito professionale pensato per trasformare le visite in richieste",
  },
  SEO: {
    gap: "siete poco visibili nelle ricerche su Google",
    consequence: "perdete clienti che cercano i vostri servizi ma trovano prima gli altri",
    solution: "un'attività di posizionamento per farvi trovare dai clienti giusti",
  },
  LOCAL: {
    gap: "la scheda Google (Maps / Profilo dell'attività) non è ottimizzata",
    consequence: "chi cerca nella vostra zona fatica a trovarvi e a contattarvi",
    solution: "l'ottimizzazione della vostra presenza locale su Google",
  },
  REVIEWS: {
    gap: "le recensioni online sono poche o poco gestite",
    consequence: "i nuovi clienti si fidano meno e scelgono chi ha più riscontri positivi",
    solution: "una strategia per raccogliere e gestire le recensioni",
  },
  SOCIAL: {
    gap: "la presenza sui social è debole o incostante",
    consequence: "il vostro marchio resta poco riconoscibile e perde occasioni di contatto",
    solution: "un progetto personalizzato di gestione dei social",
  },
  ADV: {
    gap: "non ci sono campagne pubblicitarie strutturate",
    consequence: "la crescita dipende solo dal passaparola e non è prevedibile",
    solution: "campagne pubblicitarie mirate per portare contatti qualificati",
  },
  UX: {
    gap: "l'esperienza di navigazione del sito è migliorabile",
    consequence: "molti visitatori abbandonano prima di contattarvi",
    solution: "un intervento sull'usabilità per guidare l'utente all'azione",
  },
  CONVERSION: {
    gap: "il sito riceve visite ma genera poche richieste",
    consequence: "state pagando (in tempo o in pubblicità) traffico che non diventa cliente",
    solution: "l'ottimizzazione dei percorsi che portano al contatto",
  },
  TRACKING: {
    gap: "non c'è un tracciamento dei dati e dei risultati",
    consequence: "le scelte di marketing vanno a intuito, senza sapere cosa funziona",
    solution: "un sistema chiaro per misurare i risultati",
  },
  BRAND: {
    gap: "l'immagine e il posizionamento non sono chiari",
    consequence: "il messaggio non arriva e diventa difficile distinguervi dalla concorrenza",
    solution: "un lavoro su identità e posizionamento del marchio",
  },
};

/**
 * Estrae le aree più deboli dell'audit (score < soglia) come terne
 * lacuna → conseguenza → soluzione, per un'email diretta e senza tecnicismi.
 */
export function buildAuditFindings(
  sections: { sectionKey: DigitalAuditSectionKey; score: number; issues?: string | null }[],
  max = 3,
  scoreThreshold = 65
): AuditFinding[] {
  return [...sections]
    .filter((s) => s.score < scoreThreshold)
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.max(1, max))
    .map((s) => AUDIT_SECTION_CLIENT_COPY[s.sectionKey]);
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

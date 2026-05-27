import type { DigitalAuditSectionKey, DigitalAuditStatus } from "@prisma/client";

export const digitalAuditStatusLabel: Record<DigitalAuditStatus, string> = {
  PENDING: "In attesa",
  RUNNING: "In corso",
  COMPLETED: "Completato",
  FAILED: "Fallito",
};

export const digitalAuditSectionLabel: Record<DigitalAuditSectionKey, string> = {
  WEBSITE: "Sito web",
  SEO: "SEO",
  LOCAL: "Local presence",
  REVIEWS: "Recensioni",
  SOCIAL: "Social",
  ADV: "ADV",
  UX: "UX",
  CONVERSION: "Conversione",
  TRACKING: "Tracking",
  BRAND: "Brand",
};

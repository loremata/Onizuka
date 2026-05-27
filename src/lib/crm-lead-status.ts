import type { LeadStatus } from "@prisma/client";

export const leadStatusLabel: Record<LeadStatus, string> = {
  NEW: "Nuovo",
  COLD: "Freddo",
  QUALIFIED: "Qualificato",
  CONTACTED: "Contattato",
  CONVERTED: "Convertito",
  LOST: "Perso",
};

export const leadStatusOptions: LeadStatus[] = [
  "NEW",
  "COLD",
  "QUALIFIED",
  "CONTACTED",
  "CONVERTED",
  "LOST",
];

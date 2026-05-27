import type { ClientStatus } from "@prisma/client";

/** Etichette UI per enum pipeline (spec Onizuka CRM). */
export const clientStatusLabel: Record<ClientStatus, string> = {
  LEAD_COLD: "Lead freddo",
  LEAD_QUALIFIED: "Lead qualificato",
  CONTACTED: "Contattato",
  INTERESTED: "Interessato",
  APPOINTMENT_SET: "Appuntamento fissato",
  QUOTE_SENT: "Preventivo inviato",
  NEGOTIATION: "In trattativa",
  ACTIVE_CLIENT: "Cliente attivo",
  DORMANT: "Cliente dormiente",
  LOST: "Cliente perso",
  TO_REACTIVATE: "Da riattivare",
};

/** Ordine opzioni select (allineato a Prisma enum). */
export const clientStatusOptions: ClientStatus[] = [
  "LEAD_COLD",
  "LEAD_QUALIFIED",
  "CONTACTED",
  "INTERESTED",
  "APPOINTMENT_SET",
  "QUOTE_SENT",
  "NEGOTIATION",
  "ACTIVE_CLIENT",
  "DORMANT",
  "LOST",
  "TO_REACTIVATE",
];

import type { CommercialProspectStage } from "@prisma/client";

export const commercialProspectStageLabel: Record<CommercialProspectStage, string> = {
  PROSPECT_ENTERED: "Prospect inserito",
  AUDIT_IN_PROGRESS: "Audit in corso",
  AUDIT_COMPLETED: "Audit completato",
  REPORT_GENERATED: "Report generato",
  PROPOSAL_GENERATED: "Proposta generata",
  AWAITING_SEND_APPROVAL: "In attesa approvazione invio",
  FIRST_AUDIT_MAIL_SENT: "1ª mail audit inviata",
  FOLLOW_UP_SCHEDULED: "Follow-up programmato",
  FOLLOW_UP_SENT: "Follow-up inviato",
  RESPONSE_RECEIVED: "Risposta ricevuta",
  CALL_SCHEDULED: "Call fissata",
  QUOTE_SENT: "Preventivo inviato",
  IN_NEGOTIATION: "In trattativa",
  WON: "Vinto",
  LOST: "Perso",
  NURTURING: "Nurturing",
};

export const commercialProspectStageOptions = Object.keys(
  commercialProspectStageLabel
) as CommercialProspectStage[];

import type { LeadStatus, CommercialProspectStage } from "@prisma/client";

/**
 * Coerenza degli stati del Lead (gemello di client-lifecycle):
 *  - `commercialProspectStage` = funnel dettagliato (16 stadi),
 *  - `status` (LeadStatus) = bucket grossolano per la lista CRM.
 * Lo stage è la fonte di verità fine; lo status si deriva da esso.
 */
const STAGE_TO_STATUS: Record<CommercialProspectStage, LeadStatus> = {
  PROSPECT_ENTERED: "NEW",
  AUDIT_IN_PROGRESS: "QUALIFIED",
  AUDIT_COMPLETED: "QUALIFIED",
  REPORT_GENERATED: "QUALIFIED",
  PROPOSAL_GENERATED: "QUALIFIED",
  AWAITING_SEND_APPROVAL: "CONTACTED",
  FIRST_AUDIT_MAIL_SENT: "CONTACTED",
  FOLLOW_UP_SCHEDULED: "CONTACTED",
  FOLLOW_UP_SENT: "CONTACTED",
  RESPONSE_RECEIVED: "CONTACTED",
  CALL_SCHEDULED: "CONTACTED",
  QUOTE_SENT: "CONTACTED",
  IN_NEGOTIATION: "CONTACTED",
  WON: "CONVERTED",
  LOST: "LOST",
  NURTURING: "COLD", // nurturing = lead freddo da riscaldare
};

export function statusForStage(stage: CommercialProspectStage): LeadStatus {
  return STAGE_TO_STATUS[stage];
}

/**
 * Inverso coarse status → stage rappresentativo (il MENO avanzato del bucket).
 * Serve quando si parte da uno status grossolano (cambio manuale, import CSV):
 * garantisce che `status` e `stage` restino coerenti (round-trip:
 * statusForStage(representativeStageForStatus(s)) === s).
 */
const STATUS_TO_REPRESENTATIVE_STAGE: Record<LeadStatus, CommercialProspectStage> = {
  NEW: "PROSPECT_ENTERED",
  COLD: "NURTURING",
  QUALIFIED: "AUDIT_IN_PROGRESS",
  CONTACTED: "AWAITING_SEND_APPROVAL",
  CONVERTED: "WON",
  LOST: "LOST",
};

export function representativeStageForStatus(status: LeadStatus): CommercialProspectStage {
  return STATUS_TO_REPRESENTATIVE_STAGE[status];
}

/** Coppia coerente {status, commercialProspectStage} da usare ovunque si cambi lo stage. */
export function leadLifecycleForStage(stage: CommercialProspectStage): {
  status: LeadStatus;
  commercialProspectStage: CommercialProspectStage;
} {
  return { status: STAGE_TO_STATUS[stage], commercialProspectStage: stage };
}

/** Stage terminale forzato da uno status grossolano (solo per CONVERTED/LOST). */
export function terminalStageForStatus(status: LeadStatus): CommercialProspectStage | null {
  if (status === "CONVERTED") return "WON";
  if (status === "LOST") return "LOST";
  return null;
}

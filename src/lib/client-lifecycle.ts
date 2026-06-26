import type { ClientStatus, ClientRelationshipState } from "@prisma/client";

/**
 * Macchina-stati unica del cliente (single source of truth del ciclo di vita).
 *
 * Due assi, sempre coerenti tra loro:
 *  - `relationshipState` (LEAD / CLIENTE / EX_CLIENTE) = asse MACRO "chi è".
 *  - `status` (ClientStatus) = sotto-fase del funnel dentro il macro-stato.
 *
 * Questo modulo è l'unico posto che decide la corrispondenza, così i due campi
 * non possono divergere (prima erano impostati a mano in punti diversi).
 */

/** Stadi funnel pre-cliente → relationshipState LEAD. */
const LEAD_STATUSES: ClientStatus[] = [
  "LEAD_COLD",
  "LEAD_QUALIFIED",
  "CONTACTED",
  "INTERESTED",
  "APPOINTMENT_SET",
  "QUOTE_SENT",
  "NEGOTIATION",
];

/** Stadi relazione attiva → relationshipState CLIENTE. */
const CLIENTE_STATUSES: ClientStatus[] = ["ACTIVE_CLIENT", "DORMANT"];

/** Stadi chiusura/uscita → relationshipState EX_CLIENTE. */
const EX_STATUSES: ClientStatus[] = ["LOST", "TO_REACTIVATE"];

/** Status di default quando si imposta un macro-stato senza sotto-fase coerente. */
const DEFAULT_STATUS: Record<ClientRelationshipState, ClientStatus> = {
  LEAD: "LEAD_QUALIFIED",
  CLIENTE: "ACTIVE_CLIENT",
  EX_CLIENTE: "LOST",
};

/** Deriva il macro-stato dalla sotto-fase del funnel. */
export function relationshipStateForStatus(status: ClientStatus): ClientRelationshipState {
  if (CLIENTE_STATUSES.includes(status)) return "CLIENTE";
  if (EX_STATUSES.includes(status)) return "EX_CLIENTE";
  return "LEAD";
}

/**
 * Dato un nuovo `relationshipState`, restituisce uno `status` coerente:
 * mantiene quello attuale se già appartiene al macro-stato, altrimenti il default.
 */
export function coherentStatusFor(
  state: ClientRelationshipState,
  currentStatus: ClientStatus
): ClientStatus {
  return relationshipStateForStatus(currentStatus) === state ? currentStatus : DEFAULT_STATUS[state];
}

/**
 * Dato un nuovo `status`, restituisce la coppia coerente {status, relationshipState}.
 * Da usare quando si cambia la sotto-fase del funnel.
 */
export function lifecycleForStatus(status: ClientStatus): {
  status: ClientStatus;
  relationshipState: ClientRelationshipState;
} {
  return { status, relationshipState: relationshipStateForStatus(status) };
}

/**
 * Dato un nuovo `relationshipState`, restituisce la coppia coerente.
 * Da usare quando si cambia il macro-stato (toggle scheda).
 */
export function lifecycleForRelationshipState(
  state: ClientRelationshipState,
  currentStatus: ClientStatus
): { status: ClientStatus; relationshipState: ClientRelationshipState } {
  return { status: coherentStatusFor(state, currentStatus), relationshipState: state };
}

export { LEAD_STATUSES, CLIENTE_STATUSES, EX_STATUSES };

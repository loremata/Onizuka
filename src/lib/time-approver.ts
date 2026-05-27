import type { Role } from "@prisma/client";
import { isFullAdmin } from "@/lib/auth-roles";

/** Può eseguire la 1ª approvazione su time entry (ADMIN sempre; STAFF se flag). */
export function canFirstApproveTimeEntries(role: Role, canApproveTimeEntries: boolean): boolean {
  if (isFullAdmin(role)) return true;
  return role === "STAFF" && canApproveTimeEntries;
}

/** STAFF con whitelist commesse: può approvare solo se projectCode è nella lista (vuoto = tutte). */
export function canApproveTimeEntryProject(
  projectCode: string | null,
  approverProjectCodes: string[]
): boolean {
  if (approverProjectCodes.length === 0) return true;
  const code = projectCode?.trim().toUpperCase();
  if (!code) return false;
  return approverProjectCodes.some((p) => p.trim().toUpperCase() === code);
}

/** STAFF con whitelist clienti: può approvare solo voci collegate a un cliente in lista (vuoto = tutti). */
export function canApproveTimeEntryClient(
  clientId: string | null,
  approverClientIds: string[]
): boolean {
  if (approverClientIds.length === 0) return true;
  if (!clientId) return false;
  return approverClientIds.includes(clientId);
}

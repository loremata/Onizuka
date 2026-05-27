import type { Role } from "@prisma/client";
import { isFullAdmin } from "@/lib/auth-roles";

/** Azioni granulari (deny-list su User.staffDeniedActions). */
export type StaffAdminAction =
  | "client.delete"
  | "client.merge"
  | "finance.export"
  | "finance.delete"
  | "user.manage"
  | "automation.delete"
  | "memory.unmasked_export";

export const ALL_STAFF_ACTIONS: StaffAdminAction[] = [
  "client.delete",
  "client.merge",
  "finance.export",
  "finance.delete",
  "user.manage",
  "automation.delete",
  "memory.unmasked_export",
];

export const STAFF_ACTION_LABELS: Record<StaffAdminAction, string> = {
  "client.delete": "Eliminare clienti",
  "client.merge": "Merge anagrafiche dedupe",
  "finance.export": "Export finance / contabilità",
  "finance.delete": "Eliminare movimenti finance",
  "user.manage": "Gestire utenti admin",
  "automation.delete": "Eliminare regole automazione",
  "memory.unmasked_export": "Export memoria senza maschera",
};

export function staffCanPerformAction(
  role: Role | string | undefined,
  deniedActions: string[] | null | undefined,
  action: StaffAdminAction
): boolean {
  if (isFullAdmin(role)) return true;
  const denied = deniedActions ?? [];
  return !denied.includes(action);
}

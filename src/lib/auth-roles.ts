import type { Role } from "@prisma/client";
import { isStaffRestrictedPath } from "@/lib/staff-permissions";

/** Accesso area admin (ADMIN pieno + STAFF collaboratore). */
export function isAdminAreaRole(role: Role | string | undefined): boolean {
  return role === "ADMIN" || role === "STAFF";
}

export function isFullAdmin(role: Role | string | undefined): boolean {
  return role === "ADMIN";
}

/** Percorsi riservati al solo ADMIN (non STAFF con policy predefinita/whitelist). */
export function isAdminOnlyPath(
  pathname: string,
  staffAllowedModules?: string[] | null
): boolean {
  return isStaffRestrictedPath(pathname, staffAllowedModules);
}

export function adminHomeForRole(role: Role): string {
  return isAdminAreaRole(role) ? "/admin" : "/app";
}

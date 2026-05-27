import type { Role } from "@prisma/client";
import { isFullAdmin } from "@/lib/auth-roles";

/** Moduli admin: STAFF ha accesso operativo; alcuni sono solo ADMIN. */
export type AdminModule =
  | "core"
  | "crm"
  | "flow"
  | "memory"
  | "content"
  | "reach"
  | "audit"
  | "finance"
  | "portal"
  | "integrations"
  | "users"
  | "go-live"
  | "social";

export const ALL_ADMIN_MODULES: AdminModule[] = [
  "core",
  "crm",
  "flow",
  "memory",
  "content",
  "reach",
  "audit",
  "finance",
  "portal",
  "integrations",
  "users",
  "go-live",
  "social",
];

const STAFF_DENIED_DEFAULT: AdminModule[] = ["finance", "users", "go-live", "integrations"];

const PATH_MODULE_RULES: { prefix: string; module: AdminModule }[] = [
  { prefix: "/admin/users", module: "users" },
  { prefix: "/api/admin/users", module: "users" },
  { prefix: "/admin/go-live", module: "go-live" },
  { prefix: "/api/admin/go-live", module: "go-live" },
  { prefix: "/admin/automations", module: "integrations" },
  { prefix: "/admin/automation-rules", module: "integrations" },
  { prefix: "/admin/webhooks", module: "integrations" },
  { prefix: "/api/admin/webhooks", module: "integrations" },
  { prefix: "/admin/finance", module: "finance" },
  { prefix: "/admin/economics", module: "finance" },
  { prefix: "/api/admin/finance", module: "finance" },
  { prefix: "/admin/documents", module: "crm" },
  { prefix: "/admin/approvals", module: "reach" },
  { prefix: "/api/admin/prospect-from-vat", module: "crm" },
  { prefix: "/admin/crm", module: "crm" },
  { prefix: "/admin/clients", module: "crm" },
  { prefix: "/admin/sales", module: "crm" },
  { prefix: "/admin/flow", module: "flow" },
  { prefix: "/admin/memory", module: "memory" },
  { prefix: "/api/admin/memory", module: "memory" },
  { prefix: "/admin/posts", module: "content" },
  { prefix: "/admin/reach", module: "reach" },
  { prefix: "/admin/audit", module: "audit" },
  { prefix: "/api/admin/audit", module: "audit" },
  { prefix: "/admin/client-portal", module: "portal" },
  { prefix: "/admin/voice", module: "core" },
  { prefix: "/admin/time", module: "core" },
  { prefix: "/api/admin/voice", module: "core" },
  { prefix: "/admin/settings", module: "core" },
  { prefix: "/admin/social", module: "social" },
  { prefix: "/api/integrations", module: "integrations" },
  { prefix: "/admin/whatsapp", module: "integrations" },
  { prefix: "/api/admin/whatsapp", module: "integrations" },
];

export function pathnameAdminModule(pathname: string): AdminModule {
  for (const rule of PATH_MODULE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.module;
    }
  }
  return "core";
}

export function parseStaffAllowedModules(raw: string[] | null | undefined): AdminModule[] {
  if (!raw?.length) return [];
  return raw.filter((m): m is AdminModule => ALL_ADMIN_MODULES.includes(m as AdminModule));
}

export function staffCanAccessModule(
  role: Role | string | undefined,
  module: AdminModule,
  staffAllowedModules?: string[] | null
): boolean {
  if (isFullAdmin(role)) return true;
  if (role !== "STAFF") return false;

  const whitelist = parseStaffAllowedModules(staffAllowedModules);
  if (whitelist.length > 0) {
    return whitelist.includes(module);
  }
  return !STAFF_DENIED_DEFAULT.includes(module);
}

export function staffCanAccessPath(
  role: Role | string | undefined,
  pathname: string,
  staffAllowedModules?: string[] | null
): boolean {
  return staffCanAccessModule(role, pathnameAdminModule(pathname), staffAllowedModules);
}

export function isStaffRestrictedPath(
  pathname: string,
  staffAllowedModules?: string[] | null
): boolean {
  return !staffCanAccessPath("STAFF", pathname, staffAllowedModules);
}

/** Filtra voci nav per ruolo STAFF (e whitelist opzionale). */
export function filterAdminNav<T extends { href: string }>(
  role: Role | string | undefined,
  items: T[],
  staffAllowedModules?: string[] | null
): T[] {
  return items.filter((item) => staffCanAccessPath(role, item.href, staffAllowedModules));
}

export const STAFF_MODULE_LABELS: Record<AdminModule, string> = {
  core: "Core (dashboard, impostazioni, voice)",
  crm: "CRM e clienti",
  flow: "Flow task",
  memory: "Memoria",
  content: "Contenuti",
  reach: "Reach",
  audit: "Audit",
  finance: "Finanza",
  portal: "Client portal",
  integrations: "Integrazioni / webhooks",
  users: "Utenti",
  "go-live": "Go-live",
  social: "Social Pro",
};

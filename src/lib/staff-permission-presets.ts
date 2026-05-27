import type { AdminModule } from "@/lib/staff-permissions";

export type StaffPermissionPreset = {
  id: string;
  label: string;
  description: string;
  modules: AdminModule[];
};

const OPERATIVO: AdminModule[] = [
  "core",
  "crm",
  "flow",
  "memory",
  "content",
  "reach",
  "audit",
  "portal",
];

export const STAFF_PERMISSION_PRESETS: StaffPermissionPreset[] = [
  {
    id: "operativo",
    label: "Operativo",
    description: "CRM, Flow, Reach, Audit, portale — senza Finanza/Utenti/Go-live",
    modules: OPERATIVO,
  },
  {
    id: "crm",
    label: "Solo CRM",
    description: "Clienti, pipeline, memoria legata",
    modules: ["core", "crm", "flow", "memory", "portal"],
  },
  {
    id: "content",
    label: "Contenuti & Reach",
    description: "Post, sequenze outreach, memoria",
    modules: ["core", "content", "reach", "memory"],
  },
  {
    id: "audit",
    label: "Audit & portale",
    description: "Audit digitale e ticket clienti",
    modules: ["core", "audit", "portal", "memory"],
  },
  {
    id: "integrations",
    label: "Operativo + integrazioni",
    description: "Come operativo con webhooks OAuth",
    modules: [...OPERATIVO, "integrations"],
  },
  {
    id: "default-policy",
    label: "Policy predefinita",
    description: "Nessuna whitelist — divieti standard staff",
    modules: [],
  },
];

export function getStaffPermissionPreset(id: string): StaffPermissionPreset | undefined {
  return STAFF_PERMISSION_PRESETS.find((p) => p.id === id);
}

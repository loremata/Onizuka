import type { AdminAuditLogEntry } from "@/lib/admin-audit-log";
import { ADMIN_AUDIT_ACTION_LABELS } from "@/lib/admin-audit-log";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function formatAuditLogCsv(entries: AdminAuditLogEntry[]): string {
  const header = ["data", "azione", "etichetta", "riepilogo", "attore", "entity_type", "entity_id"];
  const rows = entries.map((e) => [
    e.at.toISOString(),
    e.action,
    ADMIN_AUDIT_ACTION_LABELS[e.action] ?? e.action,
    e.summary,
    e.actorName ? `${e.actorName} <${e.actorEmail}>` : e.actorEmail,
    e.entityType ?? "",
    e.entityId ?? "",
  ]);
  return [header, ...rows].map((row) => row.map((c) => csvEscape(String(c))).join(",")).join("\n");
}

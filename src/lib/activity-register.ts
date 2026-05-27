import { prisma } from "@/lib/prisma";
import { ADMIN_AUDIT_ACTION_LABELS, AUDIT_ENTITY_TYPE_LABELS } from "@/lib/admin-audit-log";

export type ActivityRegisterRow = {
  id: string;
  at: Date;
  source: "audit" | "automation";
  action: string;
  summary: string;
  actorLabel: string;
  entityLabel: string | null;
  href: string | null;
};

function entityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "client":
      return `/admin/clients/${entityId}`;
    case "lead":
      return `/admin/crm/leads/${entityId}/edit`;
    case "opportunity":
      return `/admin/crm/opportunities/${entityId}/edit`;
    case "post":
      return `/admin/posts/${entityId}`;
    case "ticket":
      return `/admin/client-portal/tickets`;
    case "memory":
      return `/admin/memory/${entityId}/edit`;
    case "flow":
      return "/admin/flow";
    case "webhook":
      return "/admin/webhooks";
    case "user":
      return `/admin/users/${entityId}/reset-password`;
    default:
      return null;
  }
}

export async function loadActivityRegister(
  ownerUserId: string,
  options?: { limit?: number; source?: "audit" | "automation" | "all" }
): Promise<ActivityRegisterRow[]> {
  const limit = Math.min(options?.limit ?? 200, 300);
  const source = options?.source ?? "all";
  const rows: ActivityRegisterRow[] = [];

  if (source === "all" || source === "audit") {
    const audits = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { email: true, name: true } } },
    });
    for (const a of audits) {
      rows.push({
        id: `audit-${a.id}`,
        at: a.createdAt,
        source: "audit",
        action: ADMIN_AUDIT_ACTION_LABELS[a.action] ?? a.action,
        summary: a.summary,
        actorLabel: a.actor?.email ?? a.actor?.name ?? "Sistema",
        entityLabel: a.entityType
          ? `${AUDIT_ENTITY_TYPE_LABELS[a.entityType] ?? a.entityType}${a.entityId ? ` · ${a.entityId.slice(0, 8)}` : ""}`
          : null,
        href: entityHref(a.entityType, a.entityId),
      });
    }
  }

  if (source === "all" || source === "automation") {
    const executions = await prisma.automationRuleExecution.findMany({
      where: { rule: { ownerUserId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { rule: { select: { name: true, trigger: true } } },
    });
    for (const e of executions) {
      rows.push({
        id: `auto-${e.id}`,
        at: e.createdAt,
        source: "automation",
        action: e.success ? "Automazione OK" : "Automazione fallita",
        summary: `${e.rule.name} · ${e.rule.trigger} · ${e.channel}`,
        actorLabel: "Regola auto",
        entityLabel: e.errorDetail ? e.errorDetail.slice(0, 80) : null,
        href: "/admin/automation-rules",
      });
    }
  }

  return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

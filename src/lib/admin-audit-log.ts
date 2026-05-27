import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";

export type AdminAuditLogEntry = {
  id: string;
  at: Date;
  action: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  actorEmail: string;
  actorName: string | null;
};

export const ADMIN_AUDIT_ACTION_LABELS: Record<string, string> = {
  "quote.create": "Preventivo creato",
  "quote.update": "Preventivo modificato",
  "quote.status": "Stato preventivo",
  "quote.send_email": "Preventivo inviato",
  "client.create": "Cliente creato",
  "client.update": "Cliente aggiornato",
  "client.delete": "Cliente eliminato",
  "ticket.update": "Ticket aggiornato",
  "post.create": "Post creato",
  "post.status": "Stato post",
  "post.approved_client": "Approvazione cliente",
  "post.revision_client": "Revisione richiesta (cliente)",
  "post.published": "Post pubblicato",
  "webhook.create": "Webhook creato",
  "webhook.toggle": "Webhook attivato/disattivato",
  "webhook.delivery_ok": "Webhook consegnato",
  "webhook.delivery_failed": "Webhook fallito",
  "webhook.test_ok": "Test webhook OK",
  "webhook.test_failed": "Test webhook fallito",
  "webhook.delivery_retry_ok": "Retry webhook OK",
  "webhook.delivery_retry_failed": "Retry webhook fallito",
  "memory.export_unmasked": "Export memoria senza maschera",
  "user.create": "Utente creato",
  "user.reset_password": "Password reimpostata",
  "login.failed": "Login fallito",
  "lead.create": "Lead creato",
  "lead.update": "Lead aggiornato",
  "lead.delete": "Lead eliminato",
  "lead.convert": "Lead convertito",
  "client_preview.ticket_create": "Ticket da anteprima admin",
  "client_preview.post_approve": "Approvazione post da anteprima admin",
  "client_preview.upload": "Upload creatività da anteprima admin",
  "client_preview.post_revision": "Revisione post da anteprima admin",
  "opportunity.create": "Opportunità creata",
  "opportunity.update": "Opportunità aggiornata",
  "opportunity.status": "Stato opportunità",
  "opportunity.delete": "Opportunità eliminata",
  "memory.create": "Memoria creata",
  "memory.update": "Memoria aggiornata",
  "memory.delete": "Memoria eliminata",
  "flow.delete": "Task Flow eliminato",
};

export const AUDIT_FILTER_ACTIONS = Object.keys(ADMIN_AUDIT_ACTION_LABELS).sort();

export const AUDIT_ENTITY_TYPES = [
  "client",
  "post",
  "quote",
  "ticket",
  "webhook",
  "user",
  "lead",
  "opportunity",
  "memory",
  "flow",
] as const;

export const AUDIT_ENTITY_TYPE_LABELS: Record<string, string> = {
  client: "Cliente",
  post: "Contenuto",
  quote: "Preventivo",
  ticket: "Ticket",
  webhook: "Webhook",
  user: "Utente",
  lead: "Lead",
  opportunity: "Opportunità",
  memory: "Memoria",
  flow: "Flow",
};

export async function logAuditEvent(params: {
  actorUserId?: string | null;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
        action: params.action,
        summary: params.summary,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (e) {
    console.error("admin audit log failed", e);
  }
}

export const logAdminAction = logAuditEvent;

export async function logLoginFailed(email: string): Promise<void> {
  await logAuditEvent({
    action: "login.failed",
    summary: `Tentativo di accesso fallito: ${email}`,
    metadata: { email },
  });
}

export type LoadAdminAuditOptions = {
  limit?: number;
  skip?: number;
  action?: string;
  entityType?: string;
  from?: Date;
  to?: Date;
  actor?: string;
};

export function parseAuditDateParam(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value.trim());
  if (isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function buildAuditWhere(options: LoadAdminAuditOptions): Prisma.AdminAuditLogWhereInput {
  const where: Prisma.AdminAuditLogWhereInput = {};
  if (options.action?.trim()) where.action = options.action.trim();
  if (options.entityType?.trim()) where.entityType = options.entityType.trim();
  if (options.from || options.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }
  const actor = options.actor?.trim();
  if (actor) {
    if (actor.toLowerCase() === "sistema") {
      where.actorUserId = null;
    } else {
      where.actor = { email: { contains: actor, mode: "insensitive" } };
    }
  }
  return where;
}

export async function loadAdminAuditLog(
  options: LoadAdminAuditOptions = {}
): Promise<
  | { ok: true; entries: AdminAuditLogEntry[]; total: number }
  | { ok: false; reason: "unavailable" }
> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const skip = Math.max(options.skip ?? 0, 0);
  const where = buildAuditWhere(options);

  const result = await runWithDb(async () => {
    const [rows, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        select: {
          id: true,
          action: true,
          summary: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actor: { select: { email: true, name: true } },
        },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);
    return { rows, total };
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };

  return {
    ok: true,
    total: result.data.total,
    entries: result.data.rows.map((row) => ({
      id: row.id,
      at: row.createdAt,
      action: row.action,
      summary: row.summary,
      entityType: row.entityType,
      entityId: row.entityId,
      actorEmail: row.actor?.email ?? "sistema",
      actorName: row.actor?.name ?? null,
    })),
  };
}

export async function loadAllAdminAuditForExport(
  options: Omit<LoadAdminAuditOptions, "limit" | "skip"> = {},
  max = 2000
): Promise<AdminAuditLogEntry[]> {
  const loaded = await loadAdminAuditLog({ ...options, limit: max, skip: 0 });
  if (!loaded.ok) return [];
  return loaded.entries;
}

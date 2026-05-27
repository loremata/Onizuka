import { prisma } from "@/lib/prisma";

export async function logWorkspaceAudit(params: {
  workspaceId: string;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.workspaceAuditLog.create({
      data: {
        workspaceId: params.workspaceId,
        actorUserId: params.actorUserId ?? null,
        action: params.action.slice(0, 80),
        entityType: params.entityType?.slice(0, 40) ?? null,
        entityId: params.entityId?.slice(0, 80) ?? null,
        summary: params.summary.slice(0, 500),
        metadataJson: params.metadata ? JSON.stringify(params.metadata).slice(0, 8000) : null,
      },
    });
  } catch {
    /* best-effort */
  }
}

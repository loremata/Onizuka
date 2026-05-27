import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";

export type WebhookFailureRow = {
  id: string;
  at: Date;
  summary: string;
  subscriptionId: string | null;
};

export async function loadRecentWebhookDeliveryFailures(
  limit = 12
): Promise<{ ok: true; rows: WebhookFailureRow[] } | { ok: false }> {
  const result = await runWithDb(() =>
    prisma.adminAuditLog.findMany({
      where: { action: "webhook.delivery_failed" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        summary: true,
        entityId: true,
      },
    })
  );

  if (!result.ok) return { ok: false };

  return {
    ok: true,
    rows: result.data.map((r) => ({
      id: r.id,
      at: r.createdAt,
      summary: r.summary,
      subscriptionId: r.entityId,
    })),
  };
}

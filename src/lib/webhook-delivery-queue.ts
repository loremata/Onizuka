import type { WebhookEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/admin-audit-log";
import {
  deliverWebhookPost,
  logWebhookDeliverySuccess,
  type WebhookPayload,
} from "@/lib/webhook-deliver";
import { computeNextWebhookRetryAt } from "@/lib/webhook-retry-schedule";

export async function recordFailedWebhookDelivery(params: {
  subscriptionId: string;
  postItemId: string;
  event: WebhookEvent;
  targetUrl: string;
  httpStatus: number;
  errorDetail: string;
  payloadData: Omit<WebhookPayload, "signature" | "timestamp">;
  attempts: number;
}): Promise<string> {
  const row = await prisma.webhookDelivery.create({
    data: {
      subscriptionId: params.subscriptionId,
      postItemId: params.postItemId,
      event: params.event,
      targetUrl: params.targetUrl,
      httpStatus: params.httpStatus,
      errorDetail: params.errorDetail.slice(0, 2000),
      payloadJson: JSON.stringify(params.payloadData),
      status: "FAILED",
      attempts: params.attempts,
      nextRetryAt: computeNextWebhookRetryAt(params.attempts),
      lastAttemptAt: new Date(),
    },
  });
  return row.id;
}

export async function loadPendingWebhookDeliveries(limit = 15) {
  return prisma.webhookDelivery.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      subscription: { select: { id: true, client: { select: { companyName: true } } } },
    },
  });
}

export async function retryWebhookDelivery(
  deliveryId: string,
  actorUserId: string
): Promise<{ ok: true } | { ok: false; error: string; httpStatus?: number }> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { subscription: true },
  });
  if (!delivery) return { ok: false, error: "Consegna non trovata." };
  if (delivery.status === "DELIVERED") return { ok: false, error: "Già consegnata." };
  if (!delivery.subscription.isActive) {
    return { ok: false, error: "Sottoscrizione webhook disattivata." };
  }

  let payloadData: Omit<WebhookPayload, "signature" | "timestamp">;
  try {
    payloadData = JSON.parse(delivery.payloadJson) as Omit<WebhookPayload, "signature" | "timestamp">;
  } catch {
    return { ok: false, error: "Payload non valido." };
  }

  const result = await deliverWebhookPost(
    delivery.targetUrl,
    delivery.subscription.secret,
    payloadData,
    { retries: 1 }
  );
  const attempts = delivery.attempts + 1;

  if (result.ok) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "DELIVERED",
        httpStatus: result.status,
        attempts,
        lastAttemptAt: new Date(),
        deliveredAt: new Date(),
        errorDetail: null,
        nextRetryAt: null,
      },
    });
    void logWebhookDeliverySuccess({
      subscriptionId: delivery.subscriptionId,
      targetUrl: delivery.targetUrl,
      status: result.status,
      postItemId: delivery.postItemId ?? undefined,
    });
    void logAuditEvent({
      actorUserId: actorUserId === "cron" ? null : actorUserId,
      action: "webhook.delivery_retry_ok",
      entityType: "webhook",
      entityId: delivery.subscriptionId,
      summary: `Retry webhook OK (${result.status}): ${delivery.targetUrl}`,
      metadata: { deliveryId, postItemId: delivery.postItemId },
    });
    return { ok: true };
  }

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      httpStatus: result.status,
      errorDetail: result.detail,
      attempts,
      lastAttemptAt: new Date(),
      nextRetryAt: computeNextWebhookRetryAt(attempts),
    },
  });
  void logAuditEvent({
    actorUserId: actorUserId === "cron" ? null : actorUserId,
    action: "webhook.delivery_retry_failed",
    entityType: "webhook",
    entityId: delivery.subscriptionId,
    summary: `Retry webhook fallito (${result.status}): ${delivery.targetUrl}`,
    metadata: { deliveryId, postItemId: delivery.postItemId },
  });
  return { ok: false, error: result.detail || `HTTP ${result.status}`, httpStatus: result.status };
}

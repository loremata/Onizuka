import { prisma } from "@/lib/prisma";
import { retryWebhookDelivery } from "@/lib/webhook-delivery-queue";
import { computeNextWebhookRetryAt } from "@/lib/webhook-retry-schedule";

const MAX_AUTO_ATTEMPTS = 6;
const BATCH = 20;

export async function runWebhookDeliveryRetries(): Promise<{
  processed: number;
  delivered: number;
  failed: number;
  skipped: number;
}> {
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: "FAILED",
      nextRetryAt: { lte: new Date() },
      attempts: { lt: MAX_AUTO_ATTEMPTS },
    },
    orderBy: { nextRetryAt: "asc" },
    take: BATCH,
  });

  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of due) {
    const sub = await prisma.webhookSubscription.findUnique({
      where: { id: row.subscriptionId },
      select: { isActive: true },
    });
    if (!sub?.isActive) {
      await prisma.webhookDelivery.update({
        where: { id: row.id },
        data: { nextRetryAt: null },
      });
      skipped++;
      continue;
    }

    const result = await retryWebhookDelivery(row.id, "cron");
    if (result.ok) {
      delivered++;
    } else {
      failed++;
      const next = computeNextWebhookRetryAt(row.attempts + 1);
      await prisma.webhookDelivery.update({
        where: { id: row.id },
        data: { nextRetryAt: next },
      });
    }
  }

  return { processed: due.length, delivered, failed, skipped };
}

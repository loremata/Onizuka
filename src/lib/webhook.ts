import { prisma } from "@/lib/prisma";
import { notifyAdminUsers } from "@/lib/user-notifications";
import {
  deliverWebhookPost,
  logWebhookDeliveryFailure,
  logWebhookDeliverySuccess,
  resolveWebhookBaseUrl,
  toAbsoluteMediaUrl,
  type WebhookPayload,
} from "@/lib/webhook-deliver";
import { recordFailedWebhookDelivery } from "@/lib/webhook-delivery-queue";
import { notifyAdminsViaTelegram } from "@/lib/telegram-bot";
import { runPostApprovedAutomationRules } from "@/lib/automation-rules-run";

export type { WebhookPayload } from "@/lib/webhook-deliver";
export { buildSignedPayload, resolveWebhookBaseUrl } from "@/lib/webhook-deliver";

/**
 * Notify all active webhook subscriptions when a post's status changes to APPROVED or NEEDS_REVISION.
 */
export async function notifyStatusChange(postId: string): Promise<void> {
  const post = await prisma.postItem.findUnique({
    where: { id: postId },
    include: {
      client: true,
      media: true,
    },
  });

  if (!post || !post.client) return;

  const event =
    post.status === "APPROVED"
      ? ("POST_APPROVED" as const)
      : post.status === "NEEDS_REVISION"
        ? ("POST_STATUS_CHANGED" as const)
        : null;

  if (!event) return;

  const baseUrl = resolveWebhookBaseUrl();
  const mediaUrls = post.media.map((m) => toAbsoluteMediaUrl(m.url, baseUrl));

  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      isActive: true,
      event: event === "POST_APPROVED" ? "POST_APPROVED" : "POST_STATUS_CHANGED",
      OR: [{ clientId: null }, { clientId: post.clientId }],
    },
  });

  const payloadData: Omit<WebhookPayload, "signature" | "timestamp"> = {
    event,
    clientId: post.clientId,
    clientSlug: post.client.slug,
    postItemId: post.id,
    status: post.status,
    platform: post.platform,
    captionText: post.captionText,
    mediaUrls,
    updatedAt: post.updatedAt.toISOString(),
  };

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await deliverWebhookPost(sub.targetUrl, sub.secret, payloadData, { retries: 1 });
      if (result.ok) {
        void logWebhookDeliverySuccess({
          subscriptionId: sub.id,
          targetUrl: sub.targetUrl,
          status: result.status,
          postItemId: post.id,
        });
      } else {
        console.error(`Webhook ${sub.targetUrl} failed: ${result.status} ${result.detail}`);
        await recordFailedWebhookDelivery({
          subscriptionId: sub.id,
          postItemId: post.id,
          event: payloadData.event,
          targetUrl: sub.targetUrl,
          httpStatus: result.status,
          errorDetail: result.detail,
          payloadData,
          attempts: 2,
        });
        await logWebhookDeliveryFailure({
          subscriptionId: sub.id,
          targetUrl: sub.targetUrl,
          status: result.status,
          postItemId: post.id,
        });
        void notifyAdminUsers({
          kind: "webhook_failed",
          title: `Webhook fallito · ${post.client.companyName}`,
          body: `${sub.targetUrl} — HTTP ${result.status}`,
          href: "/admin/webhooks",
        }).catch(() => {});
        void notifyAdminsViaTelegram(
          `Webhook fallito · ${post.client.companyName}\n${sub.targetUrl}\nHTTP ${result.status}`
        );
      }
    })
  );

  if (event === "POST_APPROVED") {
    void runPostApprovedAutomationRules(postId);
  }
}

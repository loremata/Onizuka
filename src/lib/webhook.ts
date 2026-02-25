import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export type WebhookPayload = {
  event: "POST_APPROVED" | "POST_STATUS_CHANGED";
  clientId: string;
  clientSlug?: string;
  postItemId: string;
  status: string;
  platform: string;
  captionText: string;
  mediaUrls: string[];
  updatedAt: string; // ISO
  timestamp: number; // Unix seconds for replay check
  signature: string;
};

function sign(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${BASE_URL.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

/**
 * Build payload and sign. Body sent is JSON; signature is HMAC-SHA256(secret, that same JSON string).
 * Receiver should verify: parse body, take signature, recompute HMAC over the same JSON (with signature removed for verification), compare.
 */
export function buildSignedPayload(
  secret: string,
  data: Omit<WebhookPayload, "signature" | "timestamp">
): { payload: WebhookPayload; rawBody: string } {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadWithoutSignature = { ...data, timestamp };
  const rawBody = JSON.stringify(payloadWithoutSignature);
  const signature = sign(secret, rawBody);
  const payload = { ...payloadWithoutSignature, signature };
  return { payload, rawBody: JSON.stringify(payload) };
}

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

  const mediaUrls = post.media.map((m) => toAbsoluteUrl(m.url));

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
      const { payload, rawBody } = buildSignedPayload(sub.secret, payloadData);
      const res = await fetch(sub.targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody,
      });
      if (!res.ok) {
        console.error(`Webhook ${sub.targetUrl} failed: ${res.status} ${await res.text()}`);
      }
    })
  );
}

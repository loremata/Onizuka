import { createHmac } from "crypto";
import { logAuditEvent } from "@/lib/admin-audit-log";

export type WebhookPayload = {
  event: "POST_APPROVED" | "POST_STATUS_CHANGED";
  clientId: string;
  clientSlug?: string;
  postItemId: string;
  status: string;
  platform: string;
  captionText: string;
  mediaUrls: string[];
  updatedAt: string;
  timestamp: number;
  signature: string;
};

export type WebhookDeliveryResult =
  | { ok: true; status: number }
  | { ok: false; status: number; detail: string };

function sign(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

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

export function resolveWebhookBaseUrl(): string {
  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) return nextAuth.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function toAbsoluteMediaUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http")) return url;
  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

const RETRY_DELAY_MS = 1500;

export async function deliverWebhookPost(
  targetUrl: string,
  secret: string,
  payloadData: Omit<WebhookPayload, "signature" | "timestamp">,
  options?: { retries?: number }
): Promise<WebhookDeliveryResult> {
  const retries = options?.retries ?? 1;
  let lastStatus = 0;
  let lastDetail = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { rawBody } = buildSignedPayload(secret, payloadData);
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
    });

    if (res.ok) return { ok: true, status: res.status };

    lastStatus = res.status;
    lastDetail = (await res.text()).slice(0, 500);
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  return { ok: false, status: lastStatus, detail: lastDetail };
}

export async function deliverWebhookPing(
  subscriptionId: string,
  targetUrl: string,
  secret: string
): Promise<WebhookDeliveryResult> {
  const baseUrl = resolveWebhookBaseUrl();
  const payloadData: Omit<WebhookPayload, "signature" | "timestamp"> = {
    event: "POST_STATUS_CHANGED",
    clientId: "ping",
    clientSlug: "ping",
    postItemId: `ping-${subscriptionId}`,
    status: "PING",
    platform: "TEST",
    captionText: "Onizuka webhook test",
    mediaUrls: [`${baseUrl}/api/health`],
    updatedAt: new Date().toISOString(),
  };

  return deliverWebhookPost(targetUrl, secret, payloadData, { retries: 0 });
}

export async function logWebhookDeliverySuccess(params: {
  subscriptionId: string;
  targetUrl: string;
  status: number;
  postItemId?: string;
}): Promise<void> {
  void logAuditEvent({
    action: "webhook.delivery_ok",
    entityType: "webhook",
    entityId: params.subscriptionId,
    summary: `Webhook consegnato (${params.status}): ${params.targetUrl}`,
    metadata: { postItemId: params.postItemId, status: params.status },
  });
}

export async function logWebhookDeliveryFailure(params: {
  subscriptionId: string;
  targetUrl: string;
  status: number;
  postItemId?: string;
  actorUserId?: string;
}): Promise<void> {
  void logAuditEvent({
    actorUserId: params.actorUserId ?? null,
    action: "webhook.delivery_failed",
    entityType: "webhook",
    entityId: params.subscriptionId,
    summary: `Webhook fallito (${params.status}): ${params.targetUrl}`,
    metadata: { postItemId: params.postItemId, status: params.status },
  });
}

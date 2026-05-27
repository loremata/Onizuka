import type { Prisma, WebhookEvent } from "@prisma/client";
import { normalizeQueryParam } from "@/lib/opportunity-list-filters";

const Q_MAX = 200;

const WEBHOOK_EVENTS: WebhookEvent[] = ["POST_APPROVED", "POST_STATUS_CHANGED"];

export type WebhookListFilters = {
  q: string;
  clientId: string;
  event: WebhookEvent | null;
  /** `1` = solo attivi, `0` = solo inattivi, vuoto = tutti */
  active: "1" | "0" | null;
};

export function parseWebhookListFilters(
  searchParams: Record<string, string | string[] | undefined>
): WebhookListFilters {
  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);
  const clientId = normalizeQueryParam(searchParams.clientId);
  const eventRaw = normalizeQueryParam(searchParams.event);
  const event = WEBHOOK_EVENTS.includes(eventRaw as WebhookEvent) ? (eventRaw as WebhookEvent) : null;
  const activeRaw = normalizeQueryParam(searchParams.active);
  const active = activeRaw === "1" || activeRaw === "0" ? (activeRaw as "1" | "0") : null;
  return { q, clientId, event, active };
}

export function buildWebhookListWhere(f: WebhookListFilters): Prisma.WebhookSubscriptionWhereInput {
  const mode = "insensitive" as const;
  return {
    ...(f.clientId ? { clientId: f.clientId } : {}),
    ...(f.event ? { event: f.event } : {}),
    ...(f.active === "1" ? { isActive: true } : f.active === "0" ? { isActive: false } : {}),
    ...(f.q
      ? {
          OR: [
            { targetUrl: { contains: f.q, mode } },
            { client: { is: { companyName: { contains: f.q, mode } } } },
            { client: { is: { slug: { contains: f.q, mode } } } },
          ],
        }
      : {}),
  };
}

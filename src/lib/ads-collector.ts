import type { AnalyticsConnection } from "@prisma/client";
import { decryptJson } from "@/lib/token-crypto";
import { recordMetrics, type MetricInput } from "@/lib/analytics-store";

const META_ADS_BASE = process.env.META_GRAPH_BASE?.trim() || "https://graph.facebook.com/v19.0";
const GOOGLE_ADS_BASE = process.env.GOOGLE_ADS_API_BASE?.trim() || "https://googleads.googleapis.com/v17";

export type AdsCollectResult = { ok: true; written: number } | { error: string };

function connToken(conn: AnalyticsConnection): string | null {
  if (!conn.tokenCipher) return null;
  try {
    return decryptJson<{ accessToken: string }>(conn.tokenCipher).accessToken ?? null;
  } catch {
    return null;
  }
}

function parseDate(s: string): Date | null {
  // Meta: "2026-07-15" · Google: "2026-07-15"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

const META_CONVERSION_ACTIONS = new Set([
  "purchase",
  "lead",
  "complete_registration",
  "offsite_conversion.fb_pixel_purchase",
  "offsite_conversion.fb_pixel_lead",
]);

/** Meta Marketing API: insight giornalieri di un ad account → spend/clicks/impressions/conversions/cpc/cpm. */
export async function collectMetaAdsForConnection(conn: AnalyticsConnection): Promise<AdsCollectResult> {
  const token = connToken(conn);
  if (!token) return { error: "Token Meta Ads assente." };

  const params = new URLSearchParams({
    fields: "spend,clicks,impressions,cpc,cpm,actions",
    time_increment: "1",
    date_preset: "last_30d",
    access_token: token,
  });
  const res = await fetch(`${META_ADS_BASE}/${conn.externalId}/insights?${params}`);
  const json = (await res.json()) as {
    data?: {
      date_start?: string;
      spend?: string;
      clicks?: string;
      impressions?: string;
      cpc?: string;
      cpm?: string;
      actions?: { action_type: string; value: string }[];
    }[];
    error?: { message?: string };
  };
  if (json.error) return { error: json.error.message ?? "Meta Ads API error" };

  const clientId = conn.clientId;
  const metrics: MetricInput[] = [];
  for (const row of json.data ?? []) {
    const d = parseDate(row.date_start ?? "");
    if (!d) continue;
    const num = (v?: string) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined);
    const map: Record<string, number | undefined> = {
      spend: num(row.spend),
      clicks: num(row.clicks),
      impressions: num(row.impressions),
      cpc: num(row.cpc),
      cpm: num(row.cpm),
    };
    for (const [key, value] of Object.entries(map)) {
      if (typeof value === "number") metrics.push({ clientId, source: "META_ADS", metricKey: key, date: d, value });
    }
    const conversions = (row.actions ?? [])
      .filter((a) => META_CONVERSION_ACTIONS.has(a.action_type))
      .reduce((s, a) => s + (Number(a.value) || 0), 0);
    metrics.push({ clientId, source: "META_ADS", metricKey: "conversions", date: d, value: conversions });
  }

  const written = await recordMetrics(metrics);
  return { ok: true, written };
}

/** Google Ads API (GAQL searchStream): costo/click/impression/conversioni giornalieri di un customer. */
export async function collectGoogleAdsForConnection(conn: AnalyticsConnection): Promise<AdsCollectResult> {
  const token = connToken(conn);
  if (!token) return { error: "Token Google Ads assente." };
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!devToken) return { error: "GOOGLE_ADS_DEVELOPER_TOKEN mancante." };

  const customerId = conn.externalId.replace(/\D/g, "");
  const query =
    "SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions " +
    "FROM customer WHERE segments.date DURING LAST_30_DAYS";
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": devToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const batches = (await res.json()) as
    | { results?: { segments?: { date?: string }; metrics?: Record<string, string | number> }[] }[]
    | { error?: { message?: string } };
  if (!Array.isArray(batches)) {
    return { error: batches.error?.message ?? "Google Ads API error" };
  }

  const clientId = conn.clientId;
  const metrics: MetricInput[] = [];
  for (const batch of batches) {
    for (const r of batch.results ?? []) {
      const d = parseDate(r.segments?.date ?? "");
      if (!d) continue;
      const m = r.metrics ?? {};
      const push = (key: string, value: number | undefined) => {
        if (typeof value === "number" && Number.isFinite(value))
          metrics.push({ clientId, source: "GOOGLE_ADS", metricKey: key, date: d, value });
      };
      push("spend", m.costMicros !== undefined ? Number(m.costMicros) / 1_000_000 : undefined);
      push("clicks", m.clicks !== undefined ? Number(m.clicks) : undefined);
      push("impressions", m.impressions !== undefined ? Number(m.impressions) : undefined);
      push("conversions", m.conversions !== undefined ? Number(m.conversions) : undefined);
    }
  }

  const written = await recordMetrics(metrics);
  return { ok: true, written };
}

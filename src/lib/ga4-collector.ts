import type { AnalyticsConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadGa4AccessToken } from "@/lib/ga4-oauth";
import { recordMetrics, type MetricInput } from "@/lib/analytics-store";

const GA4_API_BASE = process.env.GA4_API_BASE?.trim() || "https://analyticsdata.googleapis.com";

type GaRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type GaReport = { rows?: GaRow[]; error?: { message?: string } };

async function runReport(property: string, token: string, body: object): Promise<GaReport> {
  const res = await fetch(`${GA4_API_BASE}/v1beta/${property}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as GaReport;
}

/** Parsa "YYYYMMDD" (dimensione date di GA4) in Date UTC. */
function parseGaDate(s: string): Date | null {
  if (!/^\d{8}$/.test(s)) return null;
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
}

export type Ga4CollectResult = { ok: true; written: number } | { error: string };

/**
 * Raccoglie le metriche GA4 di una property e le scrive su AnalyticsMetric:
 * - serie giornaliera: sessioni, pagine viste, permanenza media
 * - sorgenti di traffico (dimension channel:*) sul totale periodo
 * - pagine più viste (dimension page:*) sul totale periodo
 */
export async function collectGa4ForConnection(conn: AnalyticsConnection): Promise<Ga4CollectResult> {
  if (!conn.connectedByUserId) return { error: "Connessione senza utente Google collegato." };
  const token = await loadGa4AccessToken(conn.connectedByUserId);
  if (!token) return { error: "Token Google Analytics non disponibile (ricollega l'account)." };

  const property = conn.externalId;
  const clientId = conn.clientId;
  const metrics: MetricInput[] = [];

  // 1) Serie giornaliera
  const daily = await runReport(property, token, {
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "screenPageViews" }, { name: "averageSessionDuration" }],
  });
  if (daily.error) return { error: daily.error.message ?? "GA4 runReport error" };
  for (const row of daily.rows ?? []) {
    const d = parseGaDate(row.dimensionValues?.[0]?.value ?? "");
    if (!d) continue;
    const mv = row.metricValues ?? [];
    const keys = ["sessions", "pageviews", "avgDuration"];
    keys.forEach((key, i) => {
      const v = Number(mv[i]?.value);
      if (Number.isFinite(v)) metrics.push({ clientId, source: "GA4", metricKey: key, date: d, value: v });
    });
  }

  const today = new Date();

  // 2) Sorgenti di traffico (canale)
  const channels = await runReport(property, token, {
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
  });
  for (const row of channels.rows ?? []) {
    const ch = row.dimensionValues?.[0]?.value;
    const v = Number(row.metricValues?.[0]?.value);
    if (ch && Number.isFinite(v)) {
      metrics.push({ clientId, source: "GA4", metricKey: "sessions", date: today, value: v, dimension: `channel:${ch}` });
    }
  }

  // 3) Pagine più viste
  const pages = await runReport(property, token, {
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    limit: 10,
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
  });
  for (const row of pages.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value;
    const v = Number(row.metricValues?.[0]?.value);
    if (path && Number.isFinite(v)) {
      metrics.push({ clientId, source: "GA4", metricKey: "pageviews", date: today, value: v, dimension: `page:${path}` });
    }
  }

  const written = await recordMetrics(metrics);
  await prisma.analyticsConnection.update({
    where: { id: conn.id },
    data: { lastSyncAt: new Date(), lastError: null },
  });
  return { ok: true, written };
}

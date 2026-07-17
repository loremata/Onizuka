import type { AnalyticsSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMetricSeries, listAvailableMetrics, type SeriesPoint } from "@/lib/analytics-store";

export const sourceLabel: Record<AnalyticsSource, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  GBP: "Google Business",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  GA4: "Sito (GA4)",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
};

const metricLabel: Record<string, string> = {
  followers: "Follower",
  followersGained: "Follower guadagnati",
  followersLost: "Follower persi",
  reach: "Copertura",
  impressions: "Impression",
  engagement: "Interazioni",
  sessions: "Sessioni",
  pageviews: "Pagine viste",
  avgDuration: "Permanenza media (s)",
  spend: "Spesa (€)",
  clicks: "Click",
  conversions: "Conversioni",
  cpc: "CPC (€)",
  cpm: "CPM (€)",
};

export function labelForMetric(metricKey: string): string {
  return metricLabel[metricKey] ?? metricKey;
}

export type MetricCard = {
  source: AnalyticsSource;
  sourceLabel: string;
  metricKey: string;
  label: string;
  series: SeriesPoint[];
  latest: number | null;
  first: number | null;
  delta: number | null;
  deltaPct: number | null;
};

export type AnalyticsDashboard = {
  clientId: string;
  days: number;
  hasData: boolean;
  cards: MetricCard[];
};

export type AudienceSlice = { label: string; value: number; pct: number };
export type AudienceBreakdown = { gender: AudienceSlice[]; age: AudienceSlice[]; country: AudienceSlice[] };

const genderLabel: Record<string, string> = { F: "Donne", M: "Uomini", U: "Non spec." };

function toSlices(map: Map<string, number>, relabel?: (k: string) => string): AudienceSlice[] {
  const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
  return Array.from(map.entries())
    .map(([k, v]) => ({ label: relabel ? relabel(k) : k, value: v, pct: total > 0 ? Math.round((v / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.value - a.value);
}

/** Ultimo snapshot demografico del pubblico (età/sesso/paese), aggregato tra le piattaforme. */
export async function loadAudienceBreakdown(clientId: string): Promise<AudienceBreakdown | null> {
  const latest = await prisma.analyticsMetric.findFirst({
    where: { clientId, metricKey: "audience" },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) return null;

  const rows = await prisma.analyticsMetric.findMany({
    where: { clientId, metricKey: "audience", date: latest.date },
    select: { dimension: true, value: true },
  });

  const gender = new Map<string, number>();
  const age = new Map<string, number>();
  const country = new Map<string, number>();
  for (const r of rows) {
    const [kind, ...rest] = r.dimension.split(":");
    const key = rest.join(":");
    if (kind === "gender") gender.set(key, (gender.get(key) ?? 0) + r.value);
    else if (kind === "age") age.set(key, (age.get(key) ?? 0) + r.value);
    else if (kind === "country") country.set(key, (country.get(key) ?? 0) + r.value);
  }
  if (gender.size + age.size + country.size === 0) return null;

  return {
    gender: toSlices(gender, (k) => genderLabel[k] ?? k),
    age: toSlices(age),
    country: toSlices(country).slice(0, 6),
  };
}

export async function loadAnalyticsDashboard(clientId: string, days = 30): Promise<AnalyticsDashboard> {
  const available = await listAvailableMetrics(clientId);
  const cards: MetricCard[] = [];

  for (const a of available) {
    const series = await getMetricSeries({ clientId, source: a.source, metricKey: a.metricKey, days });
    if (series.length === 0) continue;
    const first = series[0].value;
    const latest = series[series.length - 1].value;
    const delta = latest - first;
    const deltaPct = first !== 0 ? Math.round((delta / first) * 1000) / 10 : null;
    cards.push({
      source: a.source,
      sourceLabel: sourceLabel[a.source],
      metricKey: a.metricKey,
      label: labelForMetric(a.metricKey),
      series,
      latest,
      first,
      delta,
      deltaPct,
    });
  }

  return { clientId, days, hasData: cards.length > 0, cards };
}

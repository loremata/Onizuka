import type { AnalyticsSource, SocialAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSocialAccountToken } from "@/lib/social-account";
import { dayBucket, recordMetrics, type MetricInput } from "@/lib/analytics-store";

const GRAPH_BASE = process.env.META_GRAPH_BASE?.trim() || "https://graph.facebook.com/v19.0";

export type SnapshotResult = { ok: true; written: number } | { skipped: string } | { error: string };

type GraphNode = { followers_count?: number; fan_count?: number; error?: { message?: string } };
type GraphInsights = { data?: { name: string; values?: { value: number }[] }[]; error?: { message?: string } };

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH_BASE}/${path}?${qs}`);
  return (await res.json()) as T;
}

function insightValue(json: GraphInsights, name: string): number | null {
  const row = json.data?.find((d) => d.name === name);
  const v = row?.values?.[0]?.value;
  return typeof v === "number" ? v : null;
}

type GraphObjInsights = {
  data?: { name: string; values?: { value: Record<string, number> }[] }[];
  error?: { message?: string };
};

/** Alcuni insight demografici hanno value = oggetto {chiave: conteggio}. */
function objectInsight(json: GraphObjInsights, name: string): Record<string, number> | null {
  const row = json.data?.find((d) => d.name === name);
  const v = row?.values?.[0]?.value;
  return v && typeof v === "object" ? v : null;
}

/** Follower del giorno precedente (per calcolare guadagnati/persi). */
async function previousFollowers(clientId: string, source: AnalyticsSource, today: Date): Promise<number | null> {
  const row = await prisma.analyticsMetric.findFirst({
    where: { clientId, source, metricKey: "followers", dimension: "", date: { lt: today } },
    orderBy: { date: "desc" },
    select: { value: true },
  });
  return row ? row.value : null;
}

/**
 * Snapshot giornaliero a livello account: follower (livello + guadagnati/persi), reach, impression.
 * Meta (Facebook/Instagram) implementato; LinkedIn/GBP → Fase successiva.
 */
export async function collectAccountSnapshot(account: SocialAccount): Promise<SnapshotResult> {
  if (account.status !== "CONNECTED") return { skipped: `Account ${account.status}.` };
  const token = getSocialAccountToken(account)?.accessToken;
  if (!token) return { skipped: "Token account assente." };

  const clientId = account.clientId;
  const today = dayBucket(new Date());
  const metrics: MetricInput[] = [];
  let source: AnalyticsSource;
  let followers: number | null = null;
  let reach: number | null = null;
  let impressions: number | null = null;

  if (account.platform === "FACEBOOK") {
    source = "FACEBOOK";
    const pageId = account.pageId ?? account.externalAccountId;
    const node = await graphGet<GraphNode>(pageId, { fields: "followers_count,fan_count", access_token: token });
    if (node.error) return { error: node.error.message ?? "Graph error" };
    followers = node.followers_count ?? node.fan_count ?? null;
    const ins = await graphGet<GraphInsights>(`${pageId}/insights`, {
      metric: "page_impressions,page_impressions_unique",
      period: "day",
      access_token: token,
    });
    impressions = insightValue(ins, "page_impressions");
    reach = insightValue(ins, "page_impressions_unique");
  } else if (account.platform === "INSTAGRAM") {
    source = "INSTAGRAM";
    const igId = account.igBusinessAccountId ?? account.pageId ?? account.externalAccountId;
    const node = await graphGet<GraphNode>(igId, { fields: "followers_count", access_token: token });
    if (node.error) return { error: node.error.message ?? "Graph error" };
    followers = node.followers_count ?? null;
    const ins = await graphGet<GraphInsights>(`${igId}/insights`, {
      metric: "reach,impressions",
      period: "day",
      access_token: token,
    });
    reach = insightValue(ins, "reach");
    impressions = insightValue(ins, "impressions");
  } else {
    return { skipped: `Snapshot non supportato per ${account.platform} (Fase successiva).` };
  }

  if (typeof followers === "number") {
    metrics.push({ clientId, source, metricKey: "followers", date: today, value: followers });
    const prev = await previousFollowers(clientId, source, today);
    if (prev !== null) {
      const delta = followers - prev;
      metrics.push({ clientId, source, metricKey: "followersGained", date: today, value: delta > 0 ? delta : 0 });
      metrics.push({ clientId, source, metricKey: "followersLost", date: today, value: delta < 0 ? -delta : 0 });
    }
  }
  if (typeof reach === "number") metrics.push({ clientId, source, metricKey: "reach", date: today, value: reach });
  if (typeof impressions === "number") metrics.push({ clientId, source, metricKey: "impressions", date: today, value: impressions });

  if (metrics.length === 0) return { skipped: "Nessuna metrica disponibile." };
  const written = await recordMetrics(metrics);
  return { ok: true, written };
}

/**
 * Demografici del pubblico (età, sesso, paese) via Meta Insights (period=lifetime).
 * Richiede permessi approvati e account con abbastanza follower. Scrive metricKey "audience"
 * con dimensioni "age:", "gender:", "country:" (snapshot del giorno).
 */
export async function collectAccountDemographics(account: SocialAccount): Promise<SnapshotResult> {
  if (account.status !== "CONNECTED") return { skipped: `Account ${account.status}.` };
  const token = getSocialAccountToken(account)?.accessToken;
  if (!token) return { skipped: "Token account assente." };

  let source: AnalyticsSource;
  let genderAgeMetric: string;
  let countryMetric: string;
  let nodeId: string;
  if (account.platform === "FACEBOOK") {
    source = "FACEBOOK";
    nodeId = account.pageId ?? account.externalAccountId;
    genderAgeMetric = "page_fans_gender_age";
    countryMetric = "page_fans_country";
  } else if (account.platform === "INSTAGRAM") {
    source = "INSTAGRAM";
    nodeId = account.igBusinessAccountId ?? account.pageId ?? account.externalAccountId;
    genderAgeMetric = "audience_gender_age";
    countryMetric = "audience_country";
  } else {
    return { skipped: `Demografici non supportati per ${account.platform}.` };
  }

  const clientId = account.clientId;
  const today = dayBucket(new Date());
  const metrics: MetricInput[] = [];

  const json = await graphGet<GraphObjInsights>(`${nodeId}/insights`, {
    metric: `${genderAgeMetric},${countryMetric}`,
    period: "lifetime",
    access_token: token,
  });
  if (json.error) return { error: json.error.message ?? "Graph error" };

  // gender_age: chiavi tipo "F.25-34" → accumula per genere e per età
  const genderAge = objectInsight(json, genderAgeMetric);
  if (genderAge) {
    const byGender = new Map<string, number>();
    const byAge = new Map<string, number>();
    for (const [k, v] of Object.entries(genderAge)) {
      const [g, age] = k.split(".");
      if (g) byGender.set(g, (byGender.get(g) ?? 0) + v);
      if (age) byAge.set(age, (byAge.get(age) ?? 0) + v);
    }
    for (const [g, v] of Array.from(byGender.entries()))
      metrics.push({ clientId, source, metricKey: "audience", date: today, value: v, dimension: `gender:${g}` });
    for (const [age, v] of Array.from(byAge.entries()))
      metrics.push({ clientId, source, metricKey: "audience", date: today, value: v, dimension: `age:${age}` });
  }

  // country: chiavi tipo "IT" → conteggio
  const country = objectInsight(json, countryMetric);
  if (country) {
    for (const [c, v] of Object.entries(country))
      metrics.push({ clientId, source, metricKey: "audience", date: today, value: v, dimension: `country:${c}` });
  }

  if (metrics.length === 0) return { skipped: "Nessun dato demografico disponibile." };
  const written = await recordMetrics(metrics);
  return { ok: true, written };
}

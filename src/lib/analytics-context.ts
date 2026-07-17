import { prisma } from "@/lib/prisma";
import { loadAudienceBreakdown } from "@/lib/analytics-dashboard";

/** Sintesi compatta dei dati Analytics (oltre ai post) da dare in pasto al team di esperti AI. */
export type AnalyticsContext = {
  followers: number | null;
  followerTrend30d: number | null; // guadagnati - persi
  siteSessions30d: number | null;
  topChannel: string | null;
  adSpend30d: number | null;
  adConversions30d: number | null;
  topAge: string | null;
  topCountry: string | null;
  topGender: string | null;
};

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 3600 * 1000);
}

export async function buildAnalyticsContext(clientId: string): Promise<AnalyticsContext | null> {
  const [followersRows, gained, lost, sessions, channelRows, adSpend, adConv, audience] = await Promise.all([
    prisma.analyticsMetric.findMany({
      where: { clientId, metricKey: "followers", dimension: "", source: { in: ["FACEBOOK", "INSTAGRAM"] } },
      orderBy: { date: "desc" },
      distinct: ["source"],
      select: { value: true },
    }),
    prisma.analyticsMetric.aggregate({
      where: { clientId, metricKey: "followersGained", date: { gte: since(30) } },
      _sum: { value: true },
    }),
    prisma.analyticsMetric.aggregate({
      where: { clientId, metricKey: "followersLost", date: { gte: since(30) } },
      _sum: { value: true },
    }),
    prisma.analyticsMetric.aggregate({
      where: { clientId, source: "GA4", metricKey: "sessions", dimension: "", date: { gte: since(30) } },
      _sum: { value: true },
    }),
    prisma.analyticsMetric.findMany({
      where: { clientId, source: "GA4", metricKey: "sessions", dimension: { startsWith: "channel:" } },
      orderBy: { value: "desc" },
      take: 1,
      select: { dimension: true },
    }),
    prisma.analyticsMetric.aggregate({
      where: { clientId, metricKey: "spend", source: { in: ["META_ADS", "GOOGLE_ADS"] }, date: { gte: since(30) } },
      _sum: { value: true },
    }),
    prisma.analyticsMetric.aggregate({
      where: { clientId, metricKey: "conversions", source: { in: ["META_ADS", "GOOGLE_ADS"] }, date: { gte: since(30) } },
      _sum: { value: true },
    }),
    loadAudienceBreakdown(clientId),
  ]);

  const followers = followersRows.length > 0 ? followersRows.reduce((s, r) => s + r.value, 0) : null;
  const followerTrend30d =
    gained._sum.value !== null || lost._sum.value !== null
      ? (gained._sum.value ?? 0) - (lost._sum.value ?? 0)
      : null;

  const ctx: AnalyticsContext = {
    followers,
    followerTrend30d,
    siteSessions30d: sessions._sum.value ?? null,
    topChannel: channelRows[0]?.dimension?.replace("channel:", "") ?? null,
    adSpend30d: adSpend._sum.value ?? null,
    adConversions30d: adConv._sum.value ?? null,
    topAge: audience?.age[0]?.label ?? null,
    topCountry: audience?.country[0]?.label ?? null,
    topGender: audience?.gender[0]?.label ?? null,
  };

  const hasAny = Object.values(ctx).some((v) => v !== null);
  return hasAny ? ctx : null;
}

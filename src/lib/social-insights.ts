import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { platformLabelIt } from "@/lib/post-ui-labels";

export type PlatformInsight = {
  platform: Platform;
  label: string;
  publishedCount: number;
  impressions: number;
  reach: number;
  engagement: number;
  engagementRate: number; // engagement/reach in %
};

export type TopPost = {
  id: string;
  platform: Platform;
  label: string;
  captionPreview: string;
  publishedAt: Date | null;
  impressions: number;
  reach: number;
  engagement: number;
  publishUrl: string | null;
};

export type SocialSuggestion = {
  id: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

export type SocialInsights = {
  clientId: string;
  windowDays: number;
  hasData: boolean;
  totalPublished: number;
  totals: { impressions: number; reach: number; engagement: number; engagementRate: number };
  byPlatform: PlatformInsight[];
  bestPlatform: { platform: Platform; label: string; engagementRate: number } | null;
  bestDayOfWeek: { label: string; avgEngagement: number } | null;
  bestTimeBucket: { label: string; avgEngagement: number } | null;
  topPosts: TopPost[];
  trend: { currentRate: number; previousRate: number; deltaPct: number | null };
  suggestions: SocialSuggestion[];
};

const DAY_LABELS_IT = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const TIME_BUCKETS = [
  { label: "Mattina (6–12)", from: 6, to: 12 },
  { label: "Pomeriggio (12–18)", from: 12, to: 18 },
  { label: "Sera (18–24)", from: 18, to: 24 },
  { label: "Notte (0–6)", from: 0, to: 6 },
];

function rate(engagement: number, reach: number): number {
  if (reach <= 0) return 0;
  return Math.round((engagement / reach) * 1000) / 10;
}

export async function buildSocialInsights(clientId: string, windowDays = 90): Promise<SocialInsights> {
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
  const posts = await prisma.postItem.findMany({
    where: { clientId, publishedAt: { not: null, gte: since } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      platform: true,
      captionText: true,
      publishedAt: true,
      publishUrl: true,
      impressions: true,
      reach: true,
      engagement: true,
    },
  });

  const empty: SocialInsights = {
    clientId,
    windowDays,
    hasData: false,
    totalPublished: 0,
    totals: { impressions: 0, reach: 0, engagement: 0, engagementRate: 0 },
    byPlatform: [],
    bestPlatform: null,
    bestDayOfWeek: null,
    bestTimeBucket: null,
    topPosts: [],
    trend: { currentRate: 0, previousRate: 0, deltaPct: null },
    suggestions: [],
  };
  if (posts.length === 0) return empty;

  const num = (v: number | null) => (typeof v === "number" ? v : 0);

  // Totali + per piattaforma
  const byPlatformMap = new Map<Platform, { impressions: number; reach: number; engagement: number; count: number }>();
  let tImpr = 0, tReach = 0, tEng = 0;
  for (const p of posts) {
    const impr = num(p.impressions), reach = num(p.reach), eng = num(p.engagement);
    tImpr += impr; tReach += reach; tEng += eng;
    const cur = byPlatformMap.get(p.platform) ?? { impressions: 0, reach: 0, engagement: 0, count: 0 };
    cur.impressions += impr; cur.reach += reach; cur.engagement += eng; cur.count += 1;
    byPlatformMap.set(p.platform, cur);
  }

  const byPlatform: PlatformInsight[] = Array.from(byPlatformMap.entries())
    .map(([platform, v]) => ({
      platform,
      label: platformLabelIt[platform],
      publishedCount: v.count,
      impressions: v.impressions,
      reach: v.reach,
      engagement: v.engagement,
      engagementRate: rate(v.engagement, v.reach),
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate);

  const bestPlatform =
    byPlatform.length > 0 && byPlatform[0].reach > 0
      ? { platform: byPlatform[0].platform, label: byPlatform[0].label, engagementRate: byPlatform[0].engagementRate }
      : null;

  // Miglior giorno / fascia oraria per engagement medio
  const dayAgg = new Map<number, { sum: number; count: number }>();
  const bucketAgg = new Map<string, { sum: number; count: number }>();
  for (const p of posts) {
    if (!p.publishedAt) continue;
    const eng = num(p.engagement);
    const d = p.publishedAt.getDay();
    const da = dayAgg.get(d) ?? { sum: 0, count: 0 };
    da.sum += eng; da.count += 1; dayAgg.set(d, da);
    const h = p.publishedAt.getHours();
    const bucket = TIME_BUCKETS.find((b) => h >= b.from && h < b.to) ?? TIME_BUCKETS[3];
    const ba = bucketAgg.get(bucket.label) ?? { sum: 0, count: 0 };
    ba.sum += eng; ba.count += 1; bucketAgg.set(bucket.label, ba);
  }
  const pickBest = <K>(m: Map<K, { sum: number; count: number }>) => {
    let best: { key: K; avg: number } | null = null;
    for (const [key, v] of Array.from(m.entries())) {
      const avg = v.count > 0 ? v.sum / v.count : 0;
      if (!best || avg > best.avg) best = { key, avg };
    }
    return best;
  };
  const bestDay = pickBest(dayAgg);
  const bestBucket = pickBest(bucketAgg);
  const bestDayOfWeek = bestDay
    ? { label: DAY_LABELS_IT[bestDay.key], avgEngagement: Math.round(bestDay.avg * 10) / 10 }
    : null;
  const bestTimeBucket = bestBucket
    ? { label: bestBucket.key, avgEngagement: Math.round(bestBucket.avg * 10) / 10 }
    : null;

  // Top post per engagement
  const topPosts: TopPost[] = [...posts]
    .sort((a, b) => num(b.engagement) - num(a.engagement))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      platform: p.platform,
      label: platformLabelIt[p.platform],
      captionPreview: (p.captionText || "—").slice(0, 90),
      publishedAt: p.publishedAt,
      impressions: num(p.impressions),
      reach: num(p.reach),
      engagement: num(p.engagement),
      publishUrl: p.publishUrl,
    }));

  // Trend: metà recente vs metà precedente della finestra
  const mid = new Date(Date.now() - (windowDays / 2) * 24 * 3600 * 1000);
  let curEng = 0, curReach = 0, prevEng = 0, prevReach = 0;
  for (const p of posts) {
    const eng = num(p.engagement), reach = num(p.reach);
    if (p.publishedAt && p.publishedAt >= mid) { curEng += eng; curReach += reach; }
    else { prevEng += eng; prevReach += reach; }
  }
  const currentRate = rate(curEng, curReach);
  const previousRate = rate(prevEng, prevReach);
  const deltaPct = previousRate > 0 ? Math.round(((currentRate - previousRate) / previousRate) * 1000) / 10 : null;

  const suggestions = buildSuggestions({ byPlatform, bestPlatform, bestDayOfWeek, bestTimeBucket, deltaPct, totalReach: tReach, totalEng: tEng });

  return {
    clientId,
    windowDays,
    hasData: true,
    totalPublished: posts.length,
    totals: { impressions: tImpr, reach: tReach, engagement: tEng, engagementRate: rate(tEng, tReach) },
    byPlatform,
    bestPlatform,
    bestDayOfWeek,
    bestTimeBucket,
    topPosts,
    trend: { currentRate, previousRate, deltaPct },
    suggestions,
  };
}

function buildSuggestions(x: {
  byPlatform: PlatformInsight[];
  bestPlatform: SocialInsights["bestPlatform"];
  bestDayOfWeek: SocialInsights["bestDayOfWeek"];
  bestTimeBucket: SocialInsights["bestTimeBucket"];
  deltaPct: number | null;
  totalReach: number;
  totalEng: number;
}): SocialSuggestion[] {
  const out: SocialSuggestion[] = [];

  if (x.bestPlatform) {
    out.push({
      id: "best-platform",
      title: `Punta su ${x.bestPlatform.label}`,
      detail: `È il canale con l'engagement rate più alto (${x.bestPlatform.engagementRate}%). Aumenta la frequenza qui.`,
      priority: "high",
    });
  }
  if (x.bestDayOfWeek) {
    out.push({
      id: "best-day",
      title: `Pubblica di più di ${x.bestDayOfWeek.label.toLowerCase()}`,
      detail: `I post di ${x.bestDayOfWeek.label.toLowerCase()} hanno l'engagement medio più alto (${x.bestDayOfWeek.avgEngagement}).`,
      priority: "medium",
    });
  }
  if (x.bestTimeBucket) {
    out.push({
      id: "best-time",
      title: `Orario migliore: ${x.bestTimeBucket.label}`,
      detail: `Programma i contenuti in questa fascia per massimizzare l'interazione.`,
      priority: "medium",
    });
  }
  if (x.deltaPct !== null && x.deltaPct < -10) {
    out.push({
      id: "trend-down",
      title: "Engagement in calo",
      detail: `L'engagement rate è sceso del ${Math.abs(x.deltaPct)}% rispetto al periodo precedente: cambia formato, hook o CTA.`,
      priority: "high",
    });
  }
  if (x.deltaPct !== null && x.deltaPct > 15) {
    out.push({
      id: "trend-up",
      title: "Engagement in crescita",
      detail: `+${x.deltaPct}% rispetto al periodo precedente: replica i contenuti che stanno funzionando.`,
      priority: "low",
    });
  }
  // Buona copertura ma poca interazione
  if (x.totalReach > 0 && x.totalEng / x.totalReach < 0.02) {
    out.push({
      id: "reach-no-engagement",
      title: "Copertura buona, poca interazione",
      detail: "Arrivi alle persone ma non le coinvolgi: aggiungi domande, CTA chiare e contenuti più nativi.",
      priority: "medium",
    });
  }
  // Canale debole
  const weak = x.byPlatform.find((p) => p.publishedCount >= 3 && p.reach > 0 && p.engagementRate < 1);
  if (weak) {
    out.push({
      id: `weak-${weak.platform}`,
      title: `Rivedi la strategia su ${weak.label}`,
      detail: `Engagement rate basso (${weak.engagementRate}%) su ${weak.publishedCount} post: cambia tipo di contenuto o riduci la frequenza.`,
      priority: "medium",
    });
  }

  return out;
}

import { prisma } from "@/lib/prisma";

export type ClientSocialMetrics = {
  publishedCount: number;
  scheduledCount: number;
  pendingApproval: number;
  totalImpressions: number;
  totalReach: number;
  totalEngagement: number;
  avgEngagementRate: number;
  recentPublished: {
    id: string;
    platform: string;
    captionPreview: string;
    publishedAt: Date;
    publishUrl: string | null;
    impressions: number | null;
    reach: number | null;
    engagement: number | null;
  }[];
};

export async function loadClientSocialMetrics(clientId: string): Promise<ClientSocialMetrics> {
  const posts = await prisma.postItem.findMany({
    where: { clientId },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 80,
    select: {
      id: true,
      platform: true,
      captionText: true,
      status: true,
      scheduledFor: true,
      publishedAt: true,
      publishUrl: true,
      impressions: true,
      reach: true,
      engagement: true,
      awaitingClientReview: true,
    },
  });

  const published = posts.filter((p) => p.publishedAt != null);
  const scheduledCount = posts.filter((p) => p.scheduledFor && !p.publishedAt).length;
  const pendingApproval = posts.filter((p) => p.status === "PENDING" && p.awaitingClientReview).length;

  let totalImpressions = 0;
  let totalReach = 0;
  let totalEngagement = 0;
  let metricPosts = 0;

  for (const p of published) {
    if (p.impressions != null) {
      totalImpressions += p.impressions;
      metricPosts++;
    }
    if (p.reach != null) totalReach += p.reach;
    if (p.engagement != null) totalEngagement += p.engagement;
  }

  const avgEngagementRate =
    totalReach > 0 ? Math.round((totalEngagement / totalReach) * 1000) / 10 : 0;

  return {
    publishedCount: published.length,
    scheduledCount,
    pendingApproval,
    totalImpressions,
    totalReach,
    totalEngagement,
    avgEngagementRate,
    recentPublished: published.slice(0, 12).map((p) => ({
      id: p.id,
      platform: p.platform,
      captionPreview: p.captionText.slice(0, 80) + (p.captionText.length > 80 ? "…" : ""),
      publishedAt: p.publishedAt!,
      publishUrl: p.publishUrl,
      impressions: p.impressions,
      reach: p.reach,
      engagement: p.engagement,
    })),
  };
}

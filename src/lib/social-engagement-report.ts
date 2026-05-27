import { prisma } from "@/lib/prisma";
import { platformLabelIt } from "@/lib/post-ui-labels";
import type { Platform, PostStatus } from "@prisma/client";

export type SocialEngagementRow = {
  platform: Platform;
  platformLabel: string;
  status: PostStatus;
  count: number;
};

export async function loadSocialEngagementReport(): Promise<{
  rows: SocialEngagementRow[];
  totalPosts: number;
  scheduledNext7d: number;
}> {
  const grouped = await prisma.postItem.groupBy({
    by: ["platform", "status"],
    _count: { _all: true },
  });

  const rows: SocialEngagementRow[] = grouped.map((g) => ({
    platform: g.platform,
    platformLabel: platformLabelIt[g.platform],
    status: g.status,
    count: g._count._all,
  }));

  const totalPosts = rows.reduce((a, r) => a + r.count, 0);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const scheduledNext7d = await prisma.postItem.count({
    where: { scheduledFor: { gte: new Date(), lte: in7 } },
  });

  return { rows, totalPosts, scheduledNext7d };
}

import { prisma } from "@/lib/prisma";
import { bucketCountsByDay, type DayCount } from "@/lib/client-kpi-trends";

export type AdminKpiTrends = {
  leadsLast7Days: DayCount[];
  opportunitiesWonLast7Days: DayCount[];
  postsPendingLast7Days: DayCount[];
};

export async function loadAdminKpiTrends(ownerUserId: string): Promise<AdminKpiTrends> {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const [leads, won, pendingPosts] = await Promise.all([
    prisma.lead.findMany({
      where: { ownerUserId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.opportunity.findMany({
      where: { ownerUserId, status: "WON", updatedAt: { gte: since } },
      select: { updatedAt: true },
    }),
    prisma.postItem.findMany({
      where: { status: "PENDING", createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  return {
    leadsLast7Days: bucketCountsByDay(
      leads.map((l) => l.createdAt),
      7
    ),
    opportunitiesWonLast7Days: bucketCountsByDay(
      won.map((o) => o.updatedAt),
      7
    ),
    postsPendingLast7Days: bucketCountsByDay(
      pendingPosts.map((p) => p.createdAt),
      7
    ),
  };
}

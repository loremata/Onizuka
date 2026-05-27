import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";

export type SalesStats = {
  openCount: number;
  wonLast90Days: number;
  lostLast90Days: number;
  leadsQualified: number;
  topOpen: { id: string; title: string; clientId: string; clientName: string; value: string | null }[];
};

export async function loadSalesStats(
  ownerId: string
): Promise<{ ok: true; stats: SalesStats } | { ok: false; reason: "unavailable" }> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const result = await runWithDb(async () => {
    const [openCount, wonLast90Days, lostLast90Days, leadsQualified, topOpen] = await Promise.all([
      prisma.opportunity.count({ where: { ownerUserId: ownerId, status: "OPEN" } }),
      prisma.opportunity.count({
        where: { ownerUserId: ownerId, status: "WON", updatedAt: { gte: since } },
      }),
      prisma.opportunity.count({
        where: { ownerUserId: ownerId, status: "LOST", updatedAt: { gte: since } },
      }),
      prisma.lead.count({
        where: { ownerUserId: ownerId, status: { in: ["QUALIFIED", "CONTACTED"] } },
      }),
      prisma.opportunity.findMany({
        where: { ownerUserId: ownerId, status: "OPEN" },
        orderBy: [{ estimatedValue: { sort: "desc", nulls: "last" } }],
        take: 5,
        select: {
          id: true,
          title: true,
          estimatedValue: true,
          client: { select: { id: true, companyName: true } },
          lead: { select: { id: true, businessName: true, title: true } },
        },
      }),
    ]);

    return {
      openCount,
      wonLast90Days,
      lostLast90Days,
      leadsQualified,
      topOpen: topOpen.map((o) => ({
        id: o.id,
        title: o.title,
        clientId: o.client?.id ?? o.lead?.id ?? "",
        clientName: o.client?.companyName ?? o.lead?.businessName ?? o.lead?.title ?? "Prospect",
        value: o.estimatedValue != null ? `€ ${o.estimatedValue.toString()}` : null,
      })),
    };
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };
  return { ok: true, stats: result.data };
}

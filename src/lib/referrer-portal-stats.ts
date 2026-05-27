import { prisma } from "@/lib/prisma";

export type ReferrerLeadStatusCount = { status: string; count: number };

/** Conteggi lead per stato e stima provvigione su opportunità WON dei clienti convertiti dai lead del referente. */
export async function loadReferrerPortalStats(referrerId: string, ownerUserId: string, commissionPercent: number | null) {
  const [byStatus, converted] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { referrerId },
      _count: { _all: true },
    }),
    prisma.lead.findMany({
      where: { referrerId, status: "CONVERTED", convertedClientId: { not: null } },
      select: { convertedClientId: true },
    }),
  ]);

  const statusRows: ReferrerLeadStatusCount[] = byStatus.map((r) => ({
    status: r.status,
    count: r._count._all,
  }));

  const clientIds = Array.from(
    new Set(converted.map((c) => c.convertedClientId).filter((id): id is string => id != null))
  );

  let wonOpportunitySumEur = 0;
  if (clientIds.length > 0) {
    const agg = await prisma.opportunity.aggregate({
      where: {
        ownerUserId,
        status: "WON",
        clientId: { in: clientIds },
      },
      _sum: { estimatedValue: true },
    });
    wonOpportunitySumEur = Number(agg._sum.estimatedValue?.toString() ?? "0") || 0;
  }

  const estimateEur =
    commissionPercent != null && commissionPercent > 0
      ? Math.round(wonOpportunitySumEur * (commissionPercent / 100) * 100) / 100
      : null;

  return { statusRows, wonOpportunitySumEur, estimateEur, convertedLeadCount: converted.length };
}

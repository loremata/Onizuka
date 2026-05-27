import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { syncReachAbWinners } from "@/lib/reach-ab-sync";

export type ReachMetrics = {
  sentLast30Days: number;
  sentLast7Days: number;
  approvalRatePercent: number;
  avgHoursToSend: number | null;
  openRatePercent: number;
  openedCount: number;
  clickRatePercent: number;
  clickedCount: number;
  abSentA: number;
  abSentB: number;
  abOpenRateA: number;
  abOpenRateB: number;
  abClickRateA: number;
  abClickRateB: number;
  abWinnerSuggested: string | null;
};

export async function loadReachMetrics(
  ownerId: string
): Promise<{ ok: true; metrics: ReachMetrics } | { ok: false; reason: "unavailable" }> {
  const result = await runWithDb(async () => {
    const now = new Date();
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    const [sentLast30Days, sentLast7Days, approvedCount, sentWithTiming] = await Promise.all([
      prisma.outreachDraft.count({
        where: { ownerUserId: ownerId, status: "SENT", sentAt: { gte: d30 } },
      }),
      prisma.outreachDraft.count({
        where: { ownerUserId: ownerId, status: "SENT", sentAt: { gte: d7 } },
      }),
      prisma.outreachDraft.count({
        where: { ownerUserId: ownerId, status: { in: ["APPROVED", "SENT"] } },
      }),
      prisma.outreachDraft.findMany({
        where: {
          ownerUserId: ownerId,
          status: "SENT",
          sentAt: { not: null },
        },
        select: { createdAt: true, sentAt: true },
        orderBy: { sentAt: "desc" },
        take: 50,
      }),
    ]);

    const [sentTotal, openedCount, clickedCount, abSentA, abSentB, abOpenedA, abOpenedB, abClickedA, abClickedB] =
      await Promise.all([
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "SENT" },
        }),
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "SENT", openedAt: { not: null } },
        }),
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "SENT", clickedAt: { not: null } },
        }),
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "SENT", abVariantSent: "A" },
        }),
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "SENT", abVariantSent: "B" },
        }),
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "SENT", abVariantSent: "A", openedAt: { not: null } },
        }),
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "SENT", abVariantSent: "B", openedAt: { not: null } },
        }),
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "SENT", abVariantSent: "A", clickedAt: { not: null } },
        }),
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "SENT", abVariantSent: "B", clickedAt: { not: null } },
        }),
      ]);

    const approvalRatePercent =
      approvedCount > 0 ? Math.round((sentTotal / approvedCount) * 100) : 0;
    const openRatePercent =
      sentTotal > 0 ? Math.round((openedCount / sentTotal) * 100) : 0;
    const clickRatePercent =
      sentTotal > 0 ? Math.round((clickedCount / sentTotal) * 100) : 0;
    const abOpenRateA = abSentA > 0 ? Math.round((abOpenedA / abSentA) * 100) : 0;
    const abOpenRateB = abSentB > 0 ? Math.round((abOpenedB / abSentB) * 100) : 0;
    const abClickRateA = abSentA > 0 ? Math.round((abClickedA / abSentA) * 100) : 0;
    const abClickRateB = abSentB > 0 ? Math.round((abClickedB / abSentB) * 100) : 0;

    const abWinnerSuggested = await syncReachAbWinners(ownerId);

    let avgHoursToSend: number | null = null;
    if (sentWithTiming.length > 0) {
      const hours = sentWithTiming
        .filter((d) => d.sentAt)
        .map((d) => (d.sentAt!.getTime() - d.createdAt.getTime()) / 3_600_000);
      if (hours.length > 0) {
        avgHoursToSend = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
      }
    }

    return {
      sentLast30Days,
      sentLast7Days,
      approvalRatePercent: Math.min(100, approvalRatePercent),
      avgHoursToSend,
      openRatePercent: Math.min(100, openRatePercent),
      openedCount,
      clickRatePercent: Math.min(100, clickRatePercent),
      clickedCount,
      abSentA,
      abSentB,
      abOpenRateA: Math.min(100, abOpenRateA),
      abOpenRateB: Math.min(100, abOpenRateB),
      abClickRateA: Math.min(100, abClickRateA),
      abClickRateB: Math.min(100, abClickRateB),
      abWinnerSuggested,
    };
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };
  return { ok: true, metrics: result.data };
}

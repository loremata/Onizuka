import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";

export type ReachStats = {
  leadsToFollow: number;
  dormantClients: number;
  clientsToReactivate: number;
  openOpportunities: number;
  pendingDrafts: number;
  activeSequences: number;
};

export async function loadReachStats(
  ownerId: string
): Promise<{ ok: true; stats: ReachStats } | { ok: false; reason: "unavailable" }> {
  const result = await runWithDb(async () => {
    const [leadsToFollow, dormantClients, clientsToReactivate, openOpportunities, pendingDrafts, activeSequences] =
      await Promise.all([
        prisma.lead.count({
          where: {
            ownerUserId: ownerId,
            status: { in: ["QUALIFIED", "CONTACTED", "NEW"] },
          },
        }),
        prisma.client.count({ where: { status: "DORMANT" } }),
        prisma.client.count({ where: { status: "TO_REACTIVATE" } }),
        prisma.opportunity.count({ where: { ownerUserId: ownerId, status: "OPEN" } }),
        prisma.outreachDraft.count({
          where: { ownerUserId: ownerId, status: "PENDING_APPROVAL" },
        }),
        prisma.outreachSequence.count({
          where: { ownerUserId: ownerId, status: "ACTIVE" },
        }),
      ]);

    return {
      leadsToFollow,
      dormantClients,
      clientsToReactivate,
      openOpportunities,
      pendingDrafts,
      activeSequences,
    };
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };
  return { ok: true, stats: result.data };
}

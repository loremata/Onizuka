import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { resolveRecapDayBounds } from "@/lib/day-bounds";
import { loadFinanceLedgerStats } from "@/lib/finance-ledger-stats";
import { loadClientsWithUpsellPotential } from "@/lib/client-commercial-gaps";

export type InsightsStats = {
  clientsTotal: number;
  leadsOpen: number;
  opportunitiesOpen: number;
  flowOpen: number;
  flowOverdue: number;
  flowNoDueDate: number;
  postsPending: number;
  memoryTotal: number;
  openTickets: number;
  outreachPending: number;
  activeReachSequences: number;
  financeGapEur?: number;
  financeOverdueCount?: number;
  clientsUpsell?: number;
  auditFollowUpTasks?: number;
  timeZoneLabel: string;
};

export async function loadInsightsStats(
  ownerId: string,
  userTimeZone: string | null | undefined
): Promise<{ ok: true; stats: InsightsStats } | { ok: false; reason: "unavailable" }> {
  const { start: dayStart, timeZoneLabel } = resolveRecapDayBounds({ userTimeZone });
  const openStatuses = ["TODO", "IN_PROGRESS", "WAITING"] as const;

  const result = await runWithDb(async () => {
    const [
      clientsTotal,
      leadsOpen,
      opportunitiesOpen,
      flowOpen,
      flowOverdue,
      flowNoDueDate,
      postsPending,
      memoryTotal,
      openTickets,
      outreachPending,
      activeReachSequences,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.lead.count({
        where: { ownerUserId: ownerId, status: { notIn: ["CONVERTED", "LOST"] } },
      }),
      prisma.opportunity.count({ where: { ownerUserId: ownerId, status: "OPEN" } }),
      prisma.flowTask.count({
        where: { ownerUserId: ownerId, status: { in: [...openStatuses] } },
      }),
      prisma.flowTask.count({
        where: {
          ownerUserId: ownerId,
          status: { in: [...openStatuses] },
          dueDate: { lt: dayStart },
        },
      }),
      prisma.flowTask.count({
        where: { ownerUserId: ownerId, status: { in: [...openStatuses] }, dueDate: null },
      }),
      prisma.postItem.count({ where: { status: "PENDING" } }),
      prisma.memoryItem.count({ where: { ownerUserId: ownerId } }),
      prisma.clientTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.outreachDraft.count({
        where: { ownerUserId: ownerId, status: "PENDING_APPROVAL" },
      }),
      prisma.outreachSequence.count({
        where: { ownerUserId: ownerId, status: "ACTIVE" },
      }),
    ]);

    const [ledger, upsellClients, auditFollowUpTasks] = await Promise.all([
      loadFinanceLedgerStats(ownerId),
      loadClientsWithUpsellPotential(20),
      prisma.flowTask.count({
        where: { ownerUserId: ownerId, source: "audit", status: { in: ["TODO", "IN_PROGRESS", "WAITING"] } },
      }),
    ]);

    let financeGapEur: number | undefined;
    let financeOverdueCount: number | undefined;
    if (ledger.ok) {
      const gap = Number(ledger.stats.gapToTargetEur.replace(/\./g, "").replace(",", "."));
      if (!Number.isNaN(gap) && gap > 0) financeGapEur = gap;
      financeOverdueCount = ledger.stats.overdueCount;
    }

    return {
      clientsTotal,
      leadsOpen,
      opportunitiesOpen,
      flowOpen,
      flowOverdue,
      flowNoDueDate,
      postsPending,
      memoryTotal,
      openTickets,
      outreachPending,
      activeReachSequences,
      financeGapEur,
      financeOverdueCount,
      clientsUpsell: upsellClients.length,
      auditFollowUpTasks,
      timeZoneLabel,
    };
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };
  return { ok: true, stats: result.data };
}

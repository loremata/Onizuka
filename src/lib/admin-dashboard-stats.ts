import { prisma } from "@/lib/prisma";
import { weightedPipelineEur } from "@/lib/finance-forecast";
import { runWithDb } from "@/lib/with-db";

export type AdminDashboardStats = {
  pendingPosts: number;
  flowOpen: number;
  clientsCount: number;
  memoryCount: number;
  tasksDueToday: {
    id: string;
    title: string;
    priority: string;
    client: { companyName: string } | null;
  }[];
  tasksOverdue: number;
  urgentOpen: number;
  recentMemories: { id: string; title: string; updatedAt: Date }[];
  dormantClients: number;
  opportunitiesOpen: number;
  leadsNew: number;
  openTickets: number;
  quotesDraft: number;
  pipelineWeightedEur: string;
};

export type AdminDashboardLoadResult =
  | { ok: true; stats: AdminDashboardStats }
  | { ok: false; reason: "unavailable" };

export async function loadAdminDashboardStats(
  ownerId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<AdminDashboardLoadResult> {
  const openStatuses = ["TODO", "IN_PROGRESS", "WAITING"] as const;

  const result = await runWithDb(async () => {
    const [
      pendingPosts,
      flowOpen,
      clientsCount,
      memoryCount,
      tasksDueToday,
      tasksOverdue,
      urgentOpen,
      recentMemories,
      dormantClients,
      opportunitiesOpen,
      leadsNew,
      openTickets,
      quotesDraft,
      pipelineRows,
    ] = await Promise.all([
      prisma.postItem.count({ where: { status: "PENDING" } }),
      prisma.flowTask.count({
        where: { ownerUserId: ownerId, status: { in: [...openStatuses] } },
      }),
      prisma.client.count({ where: { relationshipState: "CLIENTE" } }),
      prisma.memoryItem.count({ where: { ownerUserId: ownerId } }),
      prisma.flowTask.findMany({
        where: {
          ownerUserId: ownerId,
          status: { in: [...openStatuses] },
          dueDate: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { dueDate: "asc" },
        take: 8,
        include: { client: { select: { companyName: true } } },
      }),
      prisma.flowTask.count({
        where: {
          ownerUserId: ownerId,
          status: { in: [...openStatuses] },
          dueDate: { lt: dayStart },
        },
      }),
      prisma.flowTask.count({
        where: {
          ownerUserId: ownerId,
          status: { in: [...openStatuses] },
          priority: "URGENT",
        },
      }),
      prisma.memoryItem.findMany({
        where: { ownerUserId: ownerId },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: { id: true, title: true, updatedAt: true },
      }),
      prisma.client.count({ where: { status: "DORMANT" } }),
      prisma.opportunity.count({
        where: { ownerUserId: ownerId, status: "OPEN" },
      }),
      prisma.lead.count({
        where: { ownerUserId: ownerId, status: { in: ["NEW", "COLD", "QUALIFIED", "CONTACTED"] } },
      }),
      prisma.clientTicket.count({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.opportunityQuote.count({
        where: { ownerUserId: ownerId, status: "DRAFT" },
      }),
      prisma.opportunity.findMany({
        where: { ownerUserId: ownerId, status: "OPEN" },
        select: { estimatedValue: true, priority: true },
        take: 300,
      }),
    ]);

    return {
      pendingPosts,
      flowOpen,
      clientsCount,
      memoryCount,
      tasksDueToday,
      tasksOverdue,
      urgentOpen,
      recentMemories,
      dormantClients,
      opportunitiesOpen,
      leadsNew,
      openTickets,
      quotesDraft,
      pipelineWeightedEur: weightedPipelineEur(pipelineRows),
    };
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };
  return { ok: true, stats: result.data };
}

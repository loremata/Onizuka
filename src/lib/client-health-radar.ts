import { prisma } from "@/lib/prisma";
import { computeClientHealthScore } from "@/lib/client-health-score";

export type ClientHealthRadarRow = {
  clientId: string;
  companyName: string;
  healthScore: number;
  riskLevel: "critical" | "warning" | "stable";
  openTickets: number;
  overdueFinance: number;
  overdueFlowTasks: number;
  reason: string;
  href: string;
};

export async function loadClientHealthRadar(
  ownerUserId: string,
  limit = 20
): Promise<ClientHealthRadarRow[]> {
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { convertedFromLead: { ownerUserId } },
        { opportunities: { some: { ownerUserId } } },
      ],
    },
    take: 120,
    include: {
      _count: {
        select: { posts: true, assets: true, opportunities: true, contacts: true, flowTasks: true },
      },
      opportunities: { select: { status: true, estimatedValue: true } },
    },
  });

  const now = new Date();
  const rows: ClientHealthRadarRow[] = [];

  for (const client of clients) {
    const [openTickets, overdueFinance, overdueFlowTasks] = await Promise.all([
      prisma.clientTicket.count({
        where: { clientId: client.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.financeEntry.count({
        where: { clientId: client.id, ownerUserId, status: "OVERDUE" },
      }),
      prisma.flowTask.count({
        where: {
          relatedClientId: client.id,
          ownerUserId,
          status: { not: "DONE" },
          dueDate: { lt: now },
        },
      }),
    ]);

    const health = computeClientHealthScore({
      ...client,
      openTickets,
      overdueFinance,
      overdueFlowTasks,
      _count: { ...client._count, tickets: openTickets },
    });

    if (health.band === "healthy") continue;

    const riskLevel: ClientHealthRadarRow["riskLevel"] =
      health.score < 35 ? "critical" : health.score < 55 ? "warning" : "stable";

    rows.push({
      clientId: client.id,
      companyName: client.companyName,
      healthScore: health.score,
      riskLevel,
      openTickets,
      overdueFinance,
      overdueFlowTasks,
      reason: health.factors.slice(0, 2).join(" · ") || health.nextAction || "Monitoraggio",
      href: `/admin/clients/${client.id}`,
    });
  }

  return rows.sort((a, b) => a.healthScore - b.healthScore).slice(0, limit);
}

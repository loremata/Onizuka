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

  // Conteggi aggregati in 3 query invece di 3-per-cliente (era N+1, fino a 360 query).
  const clientIds = clients.map((c) => c.id);
  const [ticketGroups, financeGroups, flowGroups] = await Promise.all([
    clientIds.length
      ? prisma.clientTicket.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds }, status: { in: ["OPEN", "IN_PROGRESS"] } },
          _count: true,
        })
      : [],
    clientIds.length
      ? prisma.financeEntry.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds }, ownerUserId, status: "OVERDUE" },
          _count: true,
        })
      : [],
    clientIds.length
      ? prisma.flowTask.groupBy({
          by: ["relatedClientId"],
          where: { relatedClientId: { in: clientIds }, ownerUserId, status: { not: "DONE" }, dueDate: { lt: now } },
          _count: true,
        })
      : [],
  ]);
  const ticketsByClient = new Map(ticketGroups.map((g) => [g.clientId, g._count]));
  const financeByClient = new Map(financeGroups.map((g) => [g.clientId, g._count]));
  const flowByClient = new Map(flowGroups.map((g) => [g.relatedClientId, g._count]));

  const rows: ClientHealthRadarRow[] = [];

  for (const client of clients) {
    const openTickets = ticketsByClient.get(client.id) ?? 0;
    const overdueFinance = financeByClient.get(client.id) ?? 0;
    const overdueFlowTasks = flowByClient.get(client.id) ?? 0;

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

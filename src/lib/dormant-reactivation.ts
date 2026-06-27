import { prisma } from "@/lib/prisma";

export type DormantClientItem = {
  clientId: string;
  companyName: string;
  inactivityDays: number;
  openTickets: number;
  overdueFinance: number;
  potentialScore: number;
  reason: string;
};

function daysSince(date: Date | null): number {
  if (!date) return 999;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function score(input: {
  inactivityDays: number;
  openTickets: number;
  overdueFinance: number;
}): number {
  const inactivityFactor = Math.min(1, input.inactivityDays / 120);
  const friction = Math.min(1, (input.openTickets + input.overdueFinance) / 6);
  return Math.round((inactivityFactor * 0.7 + friction * 0.3) * 100);
}

export async function getDormantClients(ownerUserId: string, limit = 12): Promise<DormantClientItem[]> {
  const allClients = await prisma.client.findMany({
    where: {
      status: { in: ["DORMANT", "TO_REACTIVATE"] },
      OR: [
        { convertedFromLead: { ownerUserId } },
        { opportunities: { some: { ownerUserId } } },
      ],
    },
    take: 80,
    select: { id: true, companyName: true, updatedAt: true },
  });

  // Conteggi e ultime-attività aggregati in 5 query invece di 5-per-cliente
  // (era N+1, fino a ~400 query — e questo loader gira sulla home).
  const clientIds = allClients.map((c) => c.id);
  const [lastTickets, lastPosts, lastOpps, ticketGroups, financeGroups] = await Promise.all([
    clientIds.length
      ? prisma.clientTicket.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds } }, _max: { updatedAt: true } })
      : [],
    clientIds.length
      ? prisma.postItem.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds } }, _max: { updatedAt: true } })
      : [],
    clientIds.length
      ? prisma.opportunity.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds }, ownerUserId }, _max: { updatedAt: true } })
      : [],
    clientIds.length
      ? prisma.clientTicket.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds }, status: { in: ["OPEN", "IN_PROGRESS"] } }, _count: true })
      : [],
    clientIds.length
      ? prisma.financeEntry.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds }, ownerUserId, status: { in: ["PLANNED", "OVERDUE"] }, dueDate: { lt: new Date() } },
          _count: true,
        })
      : [],
  ]);
  const lastTicketBy = new Map(lastTickets.map((g) => [g.clientId, g._max.updatedAt]));
  const lastPostBy = new Map(lastPosts.map((g) => [g.clientId, g._max.updatedAt]));
  const lastOppBy = new Map(lastOpps.map((g) => [g.clientId, g._max.updatedAt]));
  const openTicketsBy = new Map(ticketGroups.map((g) => [g.clientId, g._count]));
  const overdueFinanceBy = new Map(financeGroups.map((g) => [g.clientId, g._count]));

  const rows: DormantClientItem[] = [];

  for (const client of allClients) {
    const openTickets = openTicketsBy.get(client.id) ?? 0;
    const overdueFinance = overdueFinanceBy.get(client.id) ?? 0;

    const dates = [
      lastTicketBy.get(client.id),
      lastPostBy.get(client.id),
      lastOppBy.get(client.id),
      client.updatedAt,
    ].filter((d): d is Date => Boolean(d));
    const latest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    const inactivityDays = daysSince(latest);
    if (inactivityDays < 45) continue;

    const potentialScore = score({ inactivityDays, openTickets, overdueFinance });
    rows.push({
      clientId: client.id,
      companyName: client.companyName,
      inactivityDays,
      openTickets,
      overdueFinance,
      potentialScore,
      reason: `Inattivo da ${inactivityDays} giorni` + (openTickets ? ` · ${openTickets} ticket` : ""),
    });
  }

  return rows.sort((a, b) => b.potentialScore - a.potentialScore).slice(0, limit);
}

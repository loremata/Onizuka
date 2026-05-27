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

  const rows: DormantClientItem[] = [];

  for (const client of allClients) {
    const [lastTicket, lastPost, lastOpp, openTickets, overdueFinance] = await Promise.all([
      prisma.clientTicket.findFirst({
        where: { clientId: client.id },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.postItem.findFirst({
        where: { clientId: client.id },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.opportunity.findFirst({
        where: { clientId: client.id, ownerUserId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.clientTicket.count({
        where: { clientId: client.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.financeEntry.count({
        where: {
          clientId: client.id,
          ownerUserId,
          status: { in: ["PLANNED", "OVERDUE"] },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    const dates = [lastTicket?.updatedAt, lastPost?.updatedAt, lastOpp?.updatedAt, client.updatedAt].filter(
      (d): d is Date => Boolean(d)
    );
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

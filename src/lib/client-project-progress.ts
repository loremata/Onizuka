import { prisma } from "@/lib/prisma";

export type ClientProjectMilestone = {
  id: string;
  label: string;
  date: Date;
  kind: "post_approved" | "post_scheduled" | "ticket_update" | "milestone";
  href: string;
};

export async function loadClientProjectProgress(clientId: string): Promise<{
  approvedLast90: number;
  scheduledUpcoming: number;
  openTickets: number;
  milestonesTotal: number;
  milestonesCompleted: number;
  onboardingTotal: number;
  onboardingCompleted: number;
  milestones: ClientProjectMilestone[];
}> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 90);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 30);

  const [
    approvedLast90,
    scheduledUpcoming,
    openTickets,
    recentApproved,
    upcoming,
    ticketUpdates,
    clientMilestones,
    onboardingRows,
  ] = await Promise.all([
      prisma.postItem.count({
        where: { clientId, status: "APPROVED", updatedAt: { gte: since } },
      }),
      prisma.postItem.count({
        where: {
          clientId,
          scheduledFor: { gte: now, lte: horizon },
          status: { in: ["PENDING", "APPROVED"] },
        },
      }),
      prisma.clientTicket.count({
        where: { clientId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.postItem.findMany({
        where: { clientId, status: "APPROVED", updatedAt: { gte: since } },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, platform: true, updatedAt: true },
      }),
      prisma.postItem.findMany({
        where: {
          clientId,
          scheduledFor: { gte: now, lte: horizon },
          status: { in: ["PENDING", "APPROVED"] },
        },
        orderBy: { scheduledFor: "asc" },
        take: 6,
        select: { id: true, platform: true, scheduledFor: true },
      }),
      prisma.clientTicketUpdate.findMany({
        where: {
          ticket: { clientId },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          ticket: { select: { id: true, title: true } },
        },
      }),
      prisma.clientMilestone.findMany({
        where: { clientId, visibleToClient: true },
        orderBy: [{ completedAt: "desc" }, { sortOrder: "asc" }],
        take: 12,
        select: {
          id: true,
          title: true,
          targetDate: true,
          completedAt: true,
          updatedAt: true,
        },
      }),
      prisma.clientOnboardingItem.findMany({
        where: { clientId },
        select: { id: true, label: true, status: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

  const milestonesTotal = clientMilestones.length;
  const milestonesCompleted = clientMilestones.filter((m) => m.completedAt).length;
  const onboardingTotal = onboardingRows.length;
  const onboardingCompleted = onboardingRows.filter((o) => o.status === "done").length;

  const milestones: ClientProjectMilestone[] = [
    ...clientMilestones.map((m) => ({
      id: `ms-${m.id}`,
      label: m.completedAt ? `✓ ${m.title}` : m.title,
      date: m.completedAt ?? m.targetDate ?? m.updatedAt,
      kind: "milestone" as const,
      href: "/app/projects",
    })),
    ...recentApproved.map((p) => ({
      id: `post-a-${p.id}`,
      label: `Post approvato · ${p.platform}`,
      date: p.updatedAt,
      kind: "post_approved" as const,
      href: `/app/posts/${p.id}`,
    })),
    ...upcoming
      .filter((p): p is typeof p & { scheduledFor: Date } => Boolean(p.scheduledFor))
      .map((p) => ({
        id: `post-s-${p.id}`,
        label: `Pubblicazione programmata · ${p.platform}`,
        date: p.scheduledFor,
        kind: "post_scheduled" as const,
        href: `/app/posts/${p.id}`,
      })),
    ...ticketUpdates.map((u) => ({
      id: `tu-${u.id}`,
      label: `Aggiornamento ticket · ${u.ticket.title}`,
      date: u.createdAt,
      kind: "ticket_update" as const,
      href: `/app/tickets`,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 14);

  return {
    approvedLast90,
    scheduledUpcoming,
    openTickets,
    milestonesTotal,
    milestonesCompleted,
    onboardingTotal,
    onboardingCompleted,
    milestones,
  };
}

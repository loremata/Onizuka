import { prisma } from "@/lib/prisma";
import { bucketCountsByDay, type DayCount } from "@/lib/client-kpi-trends";
import { countUnreadTickets, type TicketWithActivity } from "@/lib/ticket-unread";

export type ClientPortalKpi = {
  postsTotal: number;
  postsPending: number;
  postsApproved: number;
  postsRevision: number;
  approvalRatePercent: number;
  ticketsOpen: number;
  ticketsWithUnreadReplies: number;
  notificationsUnread: number;
  approvalsLast7Days: DayCount[];
};

export async function loadClientPortalKpi(clientId: string, userId: string): Promise<ClientPortalKpi> {
  const since7 = new Date();
  since7.setDate(since7.getDate() - 6);
  since7.setHours(0, 0, 0, 0);

  const [postsPending, postsApproved, postsRevision, postsTotal, tickets, notificationsUnread, recentApproved] =
    await Promise.all([
      prisma.postItem.count({ where: { clientId, status: "PENDING" } }),
      prisma.postItem.count({ where: { clientId, status: "APPROVED" } }),
      prisma.postItem.count({ where: { clientId, status: "NEEDS_REVISION" } }),
      prisma.postItem.count({ where: { clientId } }),
      prisma.clientTicket.findMany({
        where: { clientId },
        select: {
          status: true,
          updates: { select: { createdByUserId: true, clientReadAt: true } },
        },
      }),
      prisma.userNotification.count({ where: { userId, readAt: null } }),
      prisma.postItem.findMany({
        where: { clientId, status: "APPROVED", updatedAt: { gte: since7 } },
        select: { updatedAt: true },
      }),
    ]);

  const ticketsOpen = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
  const ticketsWithUnreadReplies = countUnreadTickets(tickets as TicketWithActivity[]);

  const approvalRatePercent =
    postsTotal > 0 ? Math.round((postsApproved / postsTotal) * 100) : 0;

  return {
    postsTotal,
    postsPending,
    postsApproved,
    postsRevision,
    approvalRatePercent,
    ticketsOpen,
    ticketsWithUnreadReplies,
    notificationsUnread,
    approvalsLast7Days: bucketCountsByDay(
      recentApproved.map((p) => p.updatedAt),
      7
    ),
  };
}

import { prisma } from "@/lib/prisma";
import { loadFinanceLedgerStats } from "@/lib/finance-ledger-stats";

export type ActionInboxKind =
  | "flow"
  | "outreach"
  | "ticket"
  | "finance"
  | "audit_queue"
  | "post"
  | "automation"
  | "quote";

export type ActionInboxItem = {
  id: string;
  kind: ActionInboxKind;
  title: string;
  detail: string;
  href: string;
  priority: "high" | "medium" | "low";
  createdAt: Date;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function loadActionInbox(ownerUserId: string, limit = 80): Promise<ActionInboxItem[]> {
  const today = startOfToday();
  const items: ActionInboxItem[] = [];

  const [
    flowOverdue,
    flowDueToday,
    outreachPending,
    ticketsOpen,
    auditQueuePending,
    postsPendingApproval,
    automationFailed,
    ledger,
    quotesNoResponse,
  ] = await Promise.all([
    prisma.flowTask.findMany({
      where: {
        ownerUserId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: today },
      },
      orderBy: { dueDate: "asc" },
      take: 15,
      select: { id: true, title: true, dueDate: true, client: { select: { companyName: true } } },
    }),
    prisma.flowTask.findMany({
      where: {
        ownerUserId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { gte: today, lt: new Date(today.getTime() + 86400000) },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: { id: true, title: true, dueDate: true },
    }),
    prisma.outreachDraft.findMany({
      where: { ownerUserId, status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        subject: true,
        createdAt: true,
        client: { select: { companyName: true } },
      },
    }),
    prisma.clientTicket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, title: true, updatedAt: true, client: { select: { companyName: true } } },
    }),
    prisma.auditSheetQueueItem.count({
      where: { ownerUserId, status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.postItem.findMany({
      where: { status: "PENDING", awaitingClientReview: true },
      orderBy: { scheduledFor: "asc" },
      take: 10,
      select: {
        id: true,
        scheduledFor: true,
        client: { select: { companyName: true } },
        createdAt: true,
      },
    }),
    prisma.automationFlowRun.findMany({
      where: { ownerUserId, status: "FAILED" },
      orderBy: { scheduledAt: "desc" },
      take: 8,
      select: { id: true, ruleId: true, scheduledAt: true, errorDetail: true },
    }),
    loadFinanceLedgerStats(ownerUserId),
    prisma.opportunityQuote.findMany({
      where: {
        ownerUserId,
        status: "SENT",
        noResponseDueAt: { lte: new Date() },
      },
      orderBy: { noResponseDueAt: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        noResponseDueAt: true,
        opportunity: {
          select: {
            id: true,
            client: { select: { companyName: true } },
            lead: { select: { businessName: true, title: true } },
          },
        },
      },
    }),
  ]);

  for (const t of flowOverdue) {
    items.push({
      id: `flow-${t.id}`,
      kind: "flow",
      title: t.title,
      detail: `Scaduto${t.client?.companyName ? ` · ${t.client.companyName}` : ""}`,
      href: `/admin/flow?task=${t.id}`,
      priority: "high",
      createdAt: t.dueDate ?? new Date(),
    });
  }

  for (const t of flowDueToday) {
    items.push({
      id: `flow-today-${t.id}`,
      kind: "flow",
      title: t.title,
      detail: "Scadenza oggi",
      href: `/admin/flow?task=${t.id}`,
      priority: "medium",
      createdAt: t.dueDate ?? new Date(),
    });
  }

  for (const d of outreachPending) {
    items.push({
      id: `outreach-${d.id}`,
      kind: "outreach",
      title: d.subject,
      detail: d.client?.companyName ?? "Bozza Reach",
      href: `/admin/reach?draft=${d.id}`,
      priority: "high",
      createdAt: d.createdAt,
    });
  }

  for (const t of ticketsOpen) {
    items.push({
      id: `ticket-${t.id}`,
      kind: "ticket",
      title: t.title,
      detail: t.client.companyName,
      href: `/admin/client-portal/tickets/${t.id}`,
      priority: "medium",
      createdAt: t.updatedAt,
    });
  }

  if (auditQueuePending > 0) {
    items.push({
      id: "audit-queue",
      kind: "audit_queue",
      title: "Coda audit da Google Sheet",
      detail: `${auditQueuePending} righe in attesa di elaborazione`,
      href: "/admin/audit/digital",
      priority: "high",
      createdAt: new Date(),
    });
  }

  for (const p of postsPendingApproval) {
    items.push({
      id: `post-${p.id}`,
      kind: "post",
      title: "Post in attesa cliente",
      detail: p.client.companyName,
      href: `/admin/posts/${p.id}`,
      priority: "medium",
      createdAt: p.scheduledFor ?? p.createdAt,
    });
  }

  for (const r of automationFailed) {
    items.push({
      id: `auto-${r.id}`,
      kind: "automation",
      title: "Automazione fallita",
      detail: (r.errorDetail ?? "Vedi regola").slice(0, 120),
      href: `/admin/automations?run=${r.id}`,
      priority: "high",
      createdAt: r.scheduledAt,
    });
  }

  for (const q of quotesNoResponse) {
    items.push({
      id: `quote-nr-${q.id}`,
      kind: "quote",
      title: `Proposta non risposta · ${q.opportunity.client?.companyName ?? q.opportunity.lead?.businessName ?? q.opportunity.lead?.title ?? "Prospect"}`,
      detail: q.title,
      href: `/admin/crm/opportunities/${q.opportunity.id}/quotes/${q.id}`,
      priority: "high",
      createdAt: q.noResponseDueAt ?? new Date(),
    });
  }

  if (ledger.ok && ledger.stats.overdueCount > 0) {
    items.push({
      id: "finance-overdue",
      kind: "finance",
      title: "Finance scaduto",
      detail: `${ledger.stats.overdueCount} voci oltre scadenza`,
      href: "/admin/finance",
      priority: "high",
      createdAt: new Date(),
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return items
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function countActionInboxHigh(ownerUserId: string): Promise<number> {
  const items = await loadActionInbox(ownerUserId, 200);
  return items.filter((i) => i.priority === "high").length;
}

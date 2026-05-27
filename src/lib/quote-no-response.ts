import { prisma } from "@/lib/prisma";
import { addBusinessDays } from "@/lib/business-days";
import { bumpNotificationRev } from "@/lib/notification-rev";

/** Giorni lavorativi dopo invio preventivo prima del reminder dedicato. */
export const QUOTE_NO_RESPONSE_BUSINESS_DAYS = 5;

export type QuoteNoResponseCronResult = {
  due: number;
  notified: number;
  skipped: number;
};

export async function scheduleQuoteNoResponseReminder(quoteId: string): Promise<void> {
  const quote = await prisma.opportunityQuote.findUnique({
    where: { id: quoteId },
    include: {
      opportunity: {
        select: {
          id: true,
          title: true,
          clientId: true,
          leadId: true,
          client: { select: { companyName: true } },
          lead: { select: { id: true, businessName: true, title: true } },
        },
      },
    },
  });
  if (!quote || quote.status !== "SENT") return;

  const sentAt = quote.sentAt ?? new Date();
  const noResponseDueAt = addBusinessDays(sentAt, QUOTE_NO_RESPONSE_BUSINESS_DAYS);

  await prisma.opportunityQuote.update({
    where: { id: quoteId },
    data: {
      sentAt,
      noResponseDueAt,
    },
  });

  const clientId = quote.opportunity.clientId;
  const leadId = quote.opportunity.leadId ?? quote.opportunity.lead?.id;

  const clientName =
    quote.opportunity.client?.companyName ??
    quote.opportunity.lead?.businessName ??
    quote.opportunity.lead?.title ??
    "Prospect";

  const existingTask = await prisma.flowTask.findFirst({
    where: {
      ownerUserId: quote.ownerUserId,
      title: { contains: "Proposta non risposta" },
      status: { in: ["TODO", "IN_PROGRESS"] },
      ...(clientId ? { relatedClientId: clientId } : { relatedClientId: null, source: "quote_no_response" }),
    },
    select: { id: true },
  });

  if (!existingTask) {
    const task = await prisma.flowTask.create({
      data: {
        ownerUserId: quote.ownerUserId,
        relatedClientId: clientId ?? null,
        title: `Proposta non risposta · ${clientName}`,
        description: [
          `Preventivo: ${quote.title}`,
          `Opportunità: ${quote.opportunity.title}`,
          leadId && !clientId ? `Lead: /admin/crm/leads/${leadId}/edit` : null,
          `Verifica risposta entro ${noResponseDueAt.toISOString().slice(0, 10)}.`,
          `/admin/crm/opportunities/${quote.opportunityId}/quotes/${quote.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
        status: "TODO",
        priority: "HIGH",
        dueDate: noResponseDueAt,
        source: "quote_no_response",
      },
    });
    void task;
  }

  const lead =
    leadId != null
      ? { id: leadId }
      : clientId
        ? await prisma.lead.findFirst({
            where: { convertedClientId: clientId },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          })
        : null;
  if (lead) {
    const existingFu = await prisma.leadFollowup.findFirst({
      where: {
        leadId: lead.id,
        type: "proposta_non_risposta_5d",
        outcome: "pending",
      },
    });
    if (!existingFu) {
      await prisma.leadFollowup.create({
        data: {
          leadId: lead.id,
          type: "proposta_non_risposta_5d",
          scheduledAt: noResponseDueAt,
          notes: `quote:${quoteId}`,
        },
      });
    }
  }
}

export async function clearQuoteNoResponseReminder(quoteId: string): Promise<void> {
  await prisma.opportunityQuote.update({
    where: { id: quoteId },
    data: { noResponseDueAt: null },
  });
  await prisma.leadFollowup.updateMany({
    where: { type: "proposta_non_risposta_5d", notes: { contains: quoteId }, outcome: "pending" },
    data: { outcome: "cancelled", completedAt: new Date() },
  });
}

/** Cron: notifica admin per preventivi SENT senza risposta oltre la scadenza. */
export async function runQuoteNoResponseReminders(): Promise<QuoteNoResponseCronResult> {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const dueQuotes = await prisma.opportunityQuote.findMany({
    where: {
      status: "SENT",
      noResponseDueAt: { lte: now },
    },
    include: {
      opportunity: {
        select: {
          id: true,
          title: true,
          client: { select: { companyName: true } },
          lead: { select: { businessName: true, title: true } },
        },
      },
    },
    take: 80,
  });

  let notified = 0;
  let skipped = 0;
  const bumped = new Set<string>();

  for (const q of dueQuotes) {
    const kind = "quote_no_response";
    const existing = await prisma.userNotification.findFirst({
      where: {
        userId: q.ownerUserId,
        kind,
        body: { contains: q.id },
        createdAt: { gte: dayStart },
      },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const clientName =
      q.opportunity.client?.companyName ??
      q.opportunity.lead?.businessName ??
      q.opportunity.lead?.title ??
      "Prospect";
    await prisma.userNotification.create({
      data: {
        userId: q.ownerUserId,
        kind,
        title: `Proposta non risposta · ${clientName}`,
        body: `quote:${q.id} · ${q.title}`,
        href: `/admin/crm/opportunities/${q.opportunityId}/quotes/${q.id}`,
      },
    });
    notified++;
    bumped.add(q.ownerUserId);
  }

  if (bumped.size > 0) {
    await bumpNotificationRev(Array.from(bumped));
  }

  return { due: dueQuotes.length, notified, skipped };
}

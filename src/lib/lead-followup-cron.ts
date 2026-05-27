import { prisma } from "@/lib/prisma";
import { bumpNotificationRev } from "@/lib/notification-rev";

export type LeadFollowupCronResult = {
  due: number;
  notified: number;
  skipped: number;
};

export async function runLeadFollowupReminders(): Promise<LeadFollowupCronResult> {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const dueRows = await prisma.leadFollowup.findMany({
    where: {
      outcome: "pending",
      scheduledAt: { lte: now },
      lead: { convertedClientId: null },
    },
    include: {
      lead: {
        select: {
          id: true,
          title: true,
          businessName: true,
          ownerUserId: true,
        },
      },
    },
    take: 100,
  });

  let notified = 0;
  let skipped = 0;

  for (const row of dueRows) {
    const ownerId = row.lead.ownerUserId;
    const kind = "lead_followup_due";
    const existing = await prisma.userNotification.findFirst({
      where: {
        userId: ownerId,
        kind,
        body: { contains: row.id },
        createdAt: { gte: dayStart },
      },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const name = row.lead.businessName ?? row.lead.title;
    const isQuoteNoResponse = row.type === "proposta_non_risposta_5d";
    await prisma.userNotification.create({
      data: {
        userId: ownerId,
        kind: isQuoteNoResponse ? "lead_proposta_non_risposta" : kind,
        title: isQuoteNoResponse
          ? `Proposta non risposta (lead) · ${name}`
          : `Follow-up lead · ${name}`,
        body: `followup:${row.id} · ${row.type}`,
        href: isQuoteNoResponse ? "/admin/crm/opportunities" : "/admin/crm/leads",
      },
    });
    notified++;
  }

  if (notified > 0) {
    const userIds = Array.from(new Set(dueRows.map((r) => r.lead.ownerUserId)));
    await bumpNotificationRev(userIds);
  }

  return { due: dueRows.length, notified, skipped };
}

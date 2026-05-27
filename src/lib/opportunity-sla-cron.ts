import { prisma } from "@/lib/prisma";
import { bumpNotificationRev } from "@/lib/notification-rev";
import { getOpportunityPipelineBottlenecks } from "@/lib/opportunity-pipeline-bottleneck";

export type OpportunitySlaCronResult = {
  due: number;
  notified: number;
  skipped: number;
};

export async function runOpportunitySlaReminders(): Promise<OpportunitySlaCronResult> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  let due = 0;
  let notified = 0;
  let skipped = 0;
  const bumped = new Set<string>();

  for (const admin of admins) {
    const items = await getOpportunityPipelineBottlenecks(admin.id, 20);
    for (const item of items) {
      if (item.priorityScore < 40) continue;
      due++;

      const kind = "opportunity_sla_breach";
      const existing = await prisma.userNotification.findFirst({
        where: {
          userId: admin.id,
          kind,
          body: { contains: item.opportunityId },
          createdAt: { gte: dayStart },
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.userNotification.create({
        data: {
          userId: admin.id,
          kind,
          title: `Opportunità in stallo · ${item.clientName}`,
          body: `opp:${item.opportunityId} · ${item.reason}`,
          href: `/admin/crm/opportunities?q=${encodeURIComponent(item.title)}`,
        },
      });
      notified++;
      bumped.add(admin.id);
    }
  }

  if (bumped.size > 0) {
    await bumpNotificationRev(Array.from(bumped));
  }

  return { due, notified, skipped };
}

import { prisma } from "@/lib/prisma";
import { bumpNotificationRev } from "@/lib/notification-rev";

export type MeetingFollowthroughCronResult = {
  checked: number;
  notified: number;
  skipped: number;
};

const MEETING_PREFIX = "[Meeting]";

export async function runMeetingFollowthroughReminders(): Promise<MeetingFollowthroughCronResult> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const doneMeetings = await prisma.flowTask.findMany({
    where: {
      status: "DONE",
      title: { startsWith: MEETING_PREFIX },
      updatedAt: { gte: since },
      relatedClientId: { not: null },
    },
    select: {
      id: true,
      title: true,
      ownerUserId: true,
      relatedClientId: true,
      client: { select: { companyName: true } },
    },
    take: 80,
  });

  let notified = 0;
  let skipped = 0;
  const bumped = new Set<string>();

  for (const task of doneMeetings) {
    const clientId = task.relatedClientId!;
    const hasFollowUp = await prisma.flowTask.findFirst({
      where: {
        relatedClientId: clientId,
        ownerUserId: task.ownerUserId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        OR: [
          { title: { contains: "Follow-up", mode: "insensitive" } },
          { title: { contains: "Seguito", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (hasFollowUp) continue;

    const kind = "meeting_followthrough";
    const existing = await prisma.userNotification.findFirst({
      where: {
        userId: task.ownerUserId,
        kind,
        body: { contains: task.id },
        createdAt: { gte: dayStart },
      },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const clientName = task.client?.companyName ?? "Cliente";
    await prisma.userNotification.create({
      data: {
        userId: task.ownerUserId,
        kind,
        title: `Seguito meeting · ${clientName}`,
        body: `meeting:${task.id} · Crea task di follow-up dopo «${task.title.replace(MEETING_PREFIX, "").trim()}»`,
        href: `/admin/flow?client=${clientId}`,
      },
    });
    notified++;
    bumped.add(task.ownerUserId);
  }

  if (bumped.size > 0) {
    await bumpNotificationRev(Array.from(bumped));
  }

  return { checked: doneMeetings.length, notified, skipped };
}

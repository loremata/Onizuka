import { publishNotificationRevs, readNotificationRevFromBus } from "@/lib/notification-bus";
import { prisma } from "@/lib/prisma";

/** Incrementa revisione notifiche per refresh SSE immediato. */
export async function bumpNotificationRev(userIds: string[]): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return;
  await prisma.user.updateMany({
    where: { id: { in: unique } },
    data: { notificationRev: { increment: 1 } },
  });

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, notificationRev: true },
  });
  void publishNotificationRevs(users.map((u) => ({ userId: u.id, rev: u.notificationRev })));
}

export async function getNotificationRev(userId: string): Promise<number> {
  const [u, busRev] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { notificationRev: true },
    }),
    readNotificationRevFromBus(userId),
  ]);
  const dbRev = u?.notificationRev ?? 0;
  if (busRev === null) return dbRev;
  return Math.max(dbRev, busRev);
}

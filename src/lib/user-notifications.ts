import { prisma } from "@/lib/prisma";
import { bumpNotificationRev } from "@/lib/notification-rev";

export type UserNotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export async function notifyAdminUsers(params: {
  kind: string;
  title: string;
  body?: string;
  href?: string;
}): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (users.length === 0) return;

  await prisma.userNotification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      kind: params.kind,
      title: params.title,
      body: params.body ?? null,
      href: params.href ?? null,
    })),
  });
  await bumpNotificationRev(users.map((u) => u.id));
}

export async function notifyClientUsers(params: {
  clientId: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
}): Promise<void> {
  const users = await prisma.user.findMany({
    where: { clientId: params.clientId, role: "CLIENT" },
    select: { id: true },
  });
  if (users.length === 0) return;

  await prisma.userNotification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      kind: params.kind,
      title: params.title,
      body: params.body ?? null,
      href: params.href ?? null,
    })),
  });
}

export async function loadUserNotifications(
  userId: string,
  limit = 30,
  skip = 0
): Promise<UserNotificationRow[]> {
  return prisma.userNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function countUserNotifications(userId: string): Promise<number> {
  return prisma.userNotification.count({ where: { userId } });
}

export async function loadUserNotificationsPage(
  userId: string,
  page: number,
  pageSize: number
): Promise<{ items: UserNotificationRow[]; total: number }> {
  const skip = Math.max(0, page) * pageSize;
  const [items, total] = await Promise.all([
    loadUserNotifications(userId, pageSize, skip),
    countUserNotifications(userId),
  ]);
  return { items, total };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.userNotification.count({
    where: { userId, readAt: null },
  });
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await prisma.userNotification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
  await bumpNotificationRev([userId]);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.userNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  await bumpNotificationRev([userId]);
}

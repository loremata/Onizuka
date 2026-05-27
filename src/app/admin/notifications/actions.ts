"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { sendUserNotificationDigest } from "@/lib/notification-digest";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/user-notifications";

export async function markOneAdminNotificationRead(notificationId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return;
  await markNotificationRead(notificationId, session.user.id);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function markAllAdminNotificationsReadAction(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return;
  await markAllNotificationsRead(session.user.id);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function sendAdminNotificationDigestAction(): Promise<{ error?: string; sent?: number }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return { error: "Non autorizzato" };
  const result = await sendUserNotificationDigest(session.user.id);
  if (!result.ok) return { error: result.error };
  return { sent: result.sent };
}

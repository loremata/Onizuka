"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { NotifyDigestActionResult } from "@/components/notifications/notify-digest-form";
import { sendUserNotificationDigest } from "@/lib/notification-digest";
import { saveNotifyDigestEmailPreference } from "@/lib/notify-digest-preference";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/user-notifications";

export async function markOneNotificationRead(notificationId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return;
  await markNotificationRead(notificationId, session.user.id);
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return;
  await markAllNotificationsRead(session.user.id);
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

export async function setClientNotifyDigestEmailPreference(
  _prev: NotifyDigestActionResult,
  formData: FormData
): Promise<NotifyDigestActionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const enabled = formData.get("notifyDigestEmail") === "1";
  try {
    await saveNotifyDigestEmailPreference(session.user.id, enabled);
  } catch (e) {
    console.error(e);
    return { error: "Salvataggio non riuscito." };
  }

  revalidatePath("/app/notifications");
  revalidatePath("/app");
  redirect("/app/notifications");
}

export async function sendClientNotificationDigestAction(): Promise<{ error?: string; sent?: number }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Non autorizzato" };
  const result = await sendUserNotificationDigest(session.user.id);
  if (!result.ok) return { error: result.error };
  return { sent: result.sent };
}

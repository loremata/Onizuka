"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { isValidIanaTimeZone } from "@/lib/day-bounds";
import { prisma } from "@/lib/prisma";

export type RecapTzActionResult = { error: string } | null;

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function setRecapTimeZonePreference(
  _prev: RecapTzActionResult,
  formData: FormData
): Promise<RecapTzActionResult> {
  const session = await ensureAdmin();

  const raw = (formData.get("timeZone") as string)?.trim() ?? "";

  if (raw && !isValidIanaTimeZone(raw)) {
    return { error: "Fuso orario IANA non valido." };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { timeZone: raw || null },
    });
  } catch (e) {
    console.error(e);
    return { error: "Salvataggio non riuscito." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

export async function setNotifyDigestEmailPreference(
  _prev: RecapTzActionResult,
  formData: FormData
): Promise<RecapTzActionResult> {
  const session = await ensureAdmin();
  const enabled = formData.get("notifyDigestEmail") === "1";

  try {
    const { saveNotifyDigestEmailPreference } = await import("@/lib/notify-digest-preference");
    await saveNotifyDigestEmailPreference(session.user.id, enabled);
  } catch (e) {
    console.error(e);
    return { error: "Salvataggio non riuscito." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/notifications");
  redirect("/admin/settings");
}

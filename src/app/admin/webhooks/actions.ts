"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");
  return session;
}

export async function createWebhook(
  _prev: unknown,
  formData: FormData
): Promise<{ error: string } | null> {
  await ensureAdmin();

  const event = (formData.get("event") as string)?.trim();
  const targetUrl = (formData.get("targetUrl") as string)?.trim();
  const secret = (formData.get("secret") as string)?.trim();
  const clientId = (formData.get("clientId") as string)?.trim() || null;

  if (!event || !targetUrl || !secret)
    return { error: "Event, target URL, and secret are required." };
  if (event !== "POST_APPROVED" && event !== "POST_STATUS_CHANGED")
    return { error: "Invalid event." };

  try {
    await prisma.webhookSubscription.create({
      data: { event: event as "POST_APPROVED" | "POST_STATUS_CHANGED", targetUrl, secret, clientId },
    });
  } catch (e) {
    console.error(e);
    return { error: "Failed to create webhook." };
  }

  revalidatePath("/admin/webhooks");
  redirect("/admin/webhooks");
}

export async function toggleWebhook(id: string) {
  await ensureAdmin();
  const sub = await prisma.webhookSubscription.findUnique({ where: { id } });
  if (!sub) return;
  await prisma.webhookSubscription.update({
    where: { id },
    data: { isActive: !sub.isActive },
  });
  revalidatePath("/admin/webhooks");
}

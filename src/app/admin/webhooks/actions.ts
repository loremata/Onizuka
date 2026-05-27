"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireFullAdmin } from "@/lib/admin-session";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/prisma";

async function ensureAdmin() {
  const session = await requireFullAdmin();
  return session;
}

export async function createWebhook(
  _prev: unknown,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await ensureAdmin();

  const event = (formData.get("event") as string)?.trim();
  const targetUrl = (formData.get("targetUrl") as string)?.trim();
  const secret = (formData.get("secret") as string)?.trim();
  const clientId = (formData.get("clientId") as string)?.trim() || null;

  if (!event || !targetUrl || !secret)
    return { error: "Evento, URL di destinazione e secret sono obbligatori." };
  if (event !== "POST_APPROVED" && event !== "POST_STATUS_CHANGED")
    return { error: "Evento non valido." };

  try {
    await prisma.webhookSubscription.create({
      data: { event: event as "POST_APPROVED" | "POST_STATUS_CHANGED", targetUrl, secret, clientId },
    });
  } catch (e) {
    console.error(e);
    return { error: "Creazione webhook non riuscita." };
  }

  revalidatePath("/admin/webhooks");
  revalidatePath("/admin/audit");
  revalidatePath("/admin");
  redirect("/admin/webhooks");
}

export async function toggleWebhook(id: string) {
  const session = await ensureAdmin();
  const sub = await prisma.webhookSubscription.findUnique({ where: { id } });
  if (!sub) return;
  const next = !sub.isActive;
  await prisma.webhookSubscription.update({
    where: { id },
    data: { isActive: next },
  });
  void logAuditEvent({
    actorUserId: session.user.id,
    action: "webhook.toggle",
    entityType: "webhook",
    entityId: id,
    summary: `Webhook ${sub.event} ${next ? "attivato" : "disattivato"}`,
  });
  revalidatePath("/admin/webhooks");
  revalidatePath("/admin/audit");
  revalidatePath("/admin");
}

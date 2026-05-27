"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTemplateMessage, sendWhatsAppTextMessage } from "@/lib/whatsapp-cloud";

export async function assignWhatsAppMessage(messageId: string, userId: string | null) {
  await requireAdminArea();
  await prisma.whatsAppInboundMessage.update({
    where: { id: messageId },
    data: { assignedUserId: userId || null },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/whatsapp");
}

export async function replyWhatsAppInbound(params: {
  messageId: string;
  body: string;
  templateName?: string;
}): Promise<{ error: string } | null> {
  const session = await requireAdminArea();
  const inbound = await prisma.whatsAppInboundMessage.findUnique({
    where: { id: params.messageId },
    select: { id: true, phoneFrom: true },
  });
  if (!inbound) return { error: "Messaggio non trovato." };

  const body = params.body.trim();
  const templateName = params.templateName?.trim();
  if (!body && !templateName) return { error: "Testo o template obbligatorio." };

  const sent = templateName
    ? await sendWhatsAppTemplateMessage({
        toE164: inbound.phoneFrom,
        templateName,
        languageCode: "it",
        bodyParameters: body ? [body] : undefined,
      })
    : await sendWhatsAppTextMessage({ toE164: inbound.phoneFrom, body });

  if (!sent.ok) return { error: sent.error };

  await prisma.$transaction([
    prisma.whatsAppOutboundMessage.create({
      data: {
        inboundMessageId: inbound.id,
        phoneTo: inbound.phoneFrom,
        body: body || `[template:${templateName}]`,
        templateName: templateName || null,
        sentByUserId: session.user.id,
      },
    }),
    prisma.whatsAppInboundMessage.update({
      where: { id: inbound.id },
      data: { repliedAt: new Date(), assignedUserId: session.user.id },
    }),
  ]);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/whatsapp");
  return null;
}

export async function upsertWhatsAppTemplate(formData: FormData): Promise<void> {
  await requireAdminArea();
  const name = String(formData.get("name") ?? "").trim();
  const bodyPreview = String(formData.get("bodyPreview") ?? "").trim();
  const languageCode = String(formData.get("languageCode") ?? "it").trim() || "it";
  const category = String(formData.get("category") ?? "").trim() || null;
  if (!name || !bodyPreview) return;

  await prisma.whatsAppTemplate.upsert({
    where: { name_languageCode: { name, languageCode } },
    create: { name, languageCode, bodyPreview, category },
    update: { bodyPreview, category },
  });
  revalidatePath("/admin/whatsapp");
}

export async function deleteWhatsAppTemplate(id: string): Promise<{ error: string } | null> {
  await requireAdminArea();
  await prisma.whatsAppTemplate.delete({ where: { id } });
  revalidatePath("/admin/whatsapp");
  return null;
}

export async function deleteWhatsAppTemplateForm(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await deleteWhatsAppTemplate(id);
}

export async function upsertWhatsAppPhoneLine(formData: FormData): Promise<void> {
  await requireAdminArea();
  const label = String(formData.get("label") ?? "").trim();
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  const wabaId = String(formData.get("wabaId") ?? "").trim() || null;
  const isDefault = formData.get("isDefault") === "on";
  if (!label || !phoneNumberId) return;

  if (isDefault) {
    await prisma.whatsAppPhoneLine.updateMany({ data: { isDefault: false } });
  }

  await prisma.whatsAppPhoneLine.upsert({
    where: { phoneNumberId },
    create: { label, phoneNumberId, wabaId, isDefault },
    update: { label, wabaId, isDefault },
  });
  revalidatePath("/admin/whatsapp");
}

export async function syncWhatsAppTemplatesAction(): Promise<void> {
  await requireAdminArea();
  const { syncWhatsAppTemplatesFromMeta } = await import("@/lib/whatsapp-sync-templates");
  await syncWhatsAppTemplatesFromMeta();
  revalidatePath("/admin/whatsapp");
}

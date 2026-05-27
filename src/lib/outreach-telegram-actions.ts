import { prisma } from "@/lib/prisma";
import { sendGmailViaApi } from "@/lib/gmail-api";
import { isGmailConnected } from "@/lib/gmail-oauth";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import { markOutreachDraftSent } from "@/lib/outreach-sent";
import { wrapOutreachHtmlBody } from "@/lib/outreach-tracking";
import { pickOutreachBody, pickOutreachSubject } from "@/lib/outreach-ab";
import { resolveReachAbVariantForSend } from "@/lib/reach-ab-default";
import { sendTelegramMessage } from "@/lib/telegram-bot";

export function isTelegramAdminChat(chatId: string | number): boolean {
  const ids = (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(chatId));
}

export async function approveOutreachFromTelegram(
  draftId: string,
  chatId: string | number
): Promise<{ ok: boolean; message: string }> {
  if (!isTelegramAdminChat(chatId)) {
    return { ok: false, message: "Chat non autorizzata." };
  }

  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    include: { client: { select: { contactEmail: true, companyName: true } } },
  });

  if (!draft) return { ok: false, message: "Bozza non trovata." };
  if (draft.status !== "PENDING_APPROVAL") {
    return { ok: false, message: `Stato attuale: ${draft.status}` };
  }

  await prisma.outreachDraft.update({
    where: { id: draftId },
    data: { status: "APPROVED" },
  });

  const to = draft.client?.contactEmail?.trim() ?? "";
  let sendNote = "Approvata. Invia manualmente da Reach.";
  const abVariant = await resolveReachAbVariantForSend(draft.ownerUserId, undefined);
  const subject = pickOutreachSubject(draft, abVariant);
  const emailBody = pickOutreachBody(draft, abVariant);

  if (to) {
    if (await isGmailConnected(draft.ownerUserId)) {
      const viaApi = await sendGmailViaApi(draft.ownerUserId, {
        to,
        subject,
        text: emailBody,
        html: wrapOutreachHtmlBody(emailBody, draft.id),
      });
      if (viaApi.ok) {
        await markOutreachDraftSent(draftId, draft.ownerUserId, { abVariantSent: abVariant });
        sendNote = `Approvata e inviata via Gmail a ${to} (variante ${abVariant}).`;
      }
    } else if (isSmtpConfigured()) {
      const sent = await sendEmailViaSmtp({
        to,
        subject,
        text: emailBody,
        html: wrapOutreachHtmlBody(emailBody, draft.id),
      });
      if (sent.ok) {
        await markOutreachDraftSent(draftId, draft.ownerUserId, { abVariantSent: abVariant });
        sendNote = `Approvata e inviata via SMTP a ${to} (variante ${abVariant}).`;
      } else {
        sendNote = `Approvata. SMTP: ${sent.error}`;
      }
    }
  }

  return { ok: true, message: sendNote };
}

export async function postponeOutreachFromTelegram(
  draftId: string,
  chatId: string | number
): Promise<{ ok: boolean; message: string }> {
  if (!isTelegramAdminChat(chatId)) {
    return { ok: false, message: "Chat non autorizzata." };
  }

  const draft = await prisma.outreachDraft.findUnique({ where: { id: draftId } });
  if (!draft) return { ok: false, message: "Bozza non trovata." };

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://onizuka.it";
  await sendTelegramMessage(
    chatId,
    `Rimandata. Modifica la bozza quando vuoi:\n${base}/admin/reach`
  );

  return { ok: true, message: "Reach rimandato — link inviato in chat." };
}

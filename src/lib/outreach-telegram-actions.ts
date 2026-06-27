import { prisma } from "@/lib/prisma";
import { sendOutreachDraftNow } from "@/lib/outreach-send";
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

  // Claim atomico: una sola callback "vince" il passaggio PENDING_APPROVAL→APPROVED.
  // Telegram può ritrasmettere la stessa callback → senza questo si inviava 2 volte.
  const claimed = await prisma.outreachDraft.updateMany({
    where: { id: draftId, status: "PENDING_APPROVAL" },
    data: { status: "APPROVED" },
  });
  if (claimed.count === 0) {
    const existing = await prisma.outreachDraft.findUnique({
      where: { id: draftId },
      select: { status: true },
    });
    if (!existing) return { ok: false, message: "Bozza non trovata." };
    return { ok: false, message: `Già processata (stato: ${existing.status}).` };
  }

  const result = await sendOutreachDraftNow(draftId);
  return { ok: true, message: result.sent ? `Approvata e ${result.note}` : `Approvata. ${result.note}` };
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

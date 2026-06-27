import { prisma } from "@/lib/prisma";
import { notifyAdminsViaTelegram } from "@/lib/telegram-bot";
import { bumpNotificationRev } from "@/lib/notification-rev";

export type StopOutreachReason =
  | "whatsapp_reply"
  | "lead_status"
  | "telegram_manual"
  | "manual";

const REASON_LABEL: Record<StopOutreachReason, string> = {
  whatsapp_reply: "risposta WhatsApp del lead",
  lead_status: "cambio stato del lead/cliente",
  telegram_manual: "stop manuale da Telegram",
  manual: "stop manuale",
};

/** Solo le cifre, ultime 9 (confronto robusto tra formati telefono diversi). */
function phoneTail(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(-9);
}

/**
 * Mette in PAUSED le sequenze outreach ATTIVE collegate al cliente/lead indicati,
 * così il cron non attiva più gli step di follow-up. Reversibile: per riprendere
 * basta riportare la sequenza ad ACTIVE. Gli step già inviati restano invariati.
 */
export async function stopActiveOutreachSequences(params: {
  clientId?: string | null;
  leadId?: string | null;
  reason: StopOutreachReason;
}): Promise<{ stopped: number }> {
  const or: { clientId?: string; leadId?: string }[] = [];
  if (params.clientId) or.push({ clientId: params.clientId });
  if (params.leadId) or.push({ leadId: params.leadId });
  if (!or.length) return { stopped: 0 };

  const sequences = await prisma.outreachSequence.findMany({
    where: { status: "ACTIVE", OR: or },
    select: { id: true },
  });
  if (!sequences.length) return { stopped: 0 };

  const ids = sequences.map((s) => s.id);
  await prisma.outreachSequence.updateMany({
    where: { id: { in: ids } },
    data: { status: "PAUSED" },
  });
  return { stopped: ids.length };
}

/**
 * Quando un lead/cliente risponde su un canale: oltre a fermare i follow-up,
 * registra il segnale caldo → task "Rispondi a {azienda}" (idempotente) +
 * notifica in-app e Telegram. È il momento giusto per ricontattare a mano.
 */
export async function captureHotReply(params: {
  ownerUserId: string;
  clientId?: string | null;
  company: string;
  channel: string;
}): Promise<void> {
  const { ownerUserId, clientId, company, channel } = params;

  const existing = await prisma.flowTask.findFirst({
    where: {
      ownerUserId,
      source: "hot_reply",
      status: { in: ["TODO", "IN_PROGRESS"] },
      ...(clientId ? { relatedClientId: clientId } : { relatedClientId: null }),
    },
    select: { id: true },
  });
  if (!existing) {
    await prisma.flowTask.create({
      data: {
        ownerUserId,
        relatedClientId: clientId ?? null,
        title: `Rispondi a ${company}`,
        description: `Ha risposto su ${channel}: lead caldo, ricontatta subito.${clientId ? `\n/admin/clients/${clientId}` : ""}`,
        status: "TODO",
        priority: "URGENT",
        dueDate: new Date(),
        source: "hot_reply",
      },
    });
  }

  await prisma.userNotification
    .create({
      data: {
        userId: ownerUserId,
        kind: "hot_reply",
        title: `🔥 ${company} ha risposto (${channel})`,
        body: `Lead caldo: follow-up in pausa, ricontatta a mano.`,
        href: clientId ? `/admin/clients/${clientId}` : "/admin/crm/leads",
      },
    })
    .catch(() => undefined);
  await bumpNotificationRev([ownerUserId]).catch(() => undefined);
  await notifyAdminsViaTelegram(
    `🔥 ${company} ha risposto su ${channel} — follow-up messi in pausa. Ricontatta a mano.`
  ).catch(() => undefined);
}

/**
 * Ferma le sequenze attive il cui cliente o lead ha un telefono che corrisponde al
 * numero entrante (best-effort, confronto sulle ultime 9 cifre). Scansiona solo le
 * sequenze ATTIVE (poche), quindi è leggero anche senza indice telefono.
 * Registra anche il segnale caldo (task + notifica) per ogni azienda coinvolta.
 */
export async function stopSequencesByInboundPhone(
  phoneFrom: string
): Promise<{ stopped: number }> {
  const target = phoneTail(phoneFrom);
  if (!target) return { stopped: 0 };

  const active = await prisma.outreachSequence.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      ownerUserId: true,
      clientId: true,
      client: { select: { phone: true, companyName: true } },
      lead: { select: { phone: true, businessName: true, title: true } },
    },
  });

  const matched = active.filter(
    (s) => phoneTail(s.client?.phone) === target || phoneTail(s.lead?.phone) === target
  );
  if (!matched.length) return { stopped: 0 };

  const ids = matched.map((s) => s.id);
  await prisma.outreachSequence.updateMany({
    where: { id: { in: ids } },
    data: { status: "PAUSED" },
  });

  for (const s of matched) {
    const company =
      s.client?.companyName ?? s.lead?.businessName ?? s.lead?.title ?? "Lead";
    await captureHotReply({
      ownerUserId: s.ownerUserId,
      clientId: s.clientId,
      company,
      channel: "WhatsApp",
    }).catch(() => undefined);
  }

  return { stopped: ids.length };
}

/** Ferma la sequenza collegata a una bozza (per il bottone "Stop" su Telegram). */
export async function stopOutreachSequenceByDraftId(
  draftId: string,
  reason: StopOutreachReason = "telegram_manual"
): Promise<{ stopped: number; companyName?: string }> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    select: {
      clientId: true,
      leadId: true,
      client: { select: { companyName: true } },
      lead: { select: { businessName: true, title: true } },
    },
  });
  if (!draft) return { stopped: 0 };

  const res = await stopActiveOutreachSequences({
    clientId: draft.clientId,
    leadId: draft.leadId,
    reason,
  });
  const companyName =
    draft.client?.companyName ?? draft.lead?.businessName ?? draft.lead?.title ?? undefined;
  return { ...res, companyName };
}

export function stopReasonLabel(reason: StopOutreachReason): string {
  return REASON_LABEL[reason];
}

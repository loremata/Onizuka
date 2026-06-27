import { prisma } from "@/lib/prisma";

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
 * Ferma le sequenze attive il cui cliente o lead ha un telefono che corrisponde al
 * numero entrante (best-effort, confronto sulle ultime 9 cifre). Scansiona solo le
 * sequenze ATTIVE (poche), quindi è leggero anche senza indice telefono.
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
      client: { select: { phone: true } },
      lead: { select: { phone: true } },
    },
  });

  const ids = active
    .filter((s) => phoneTail(s.client?.phone) === target || phoneTail(s.lead?.phone) === target)
    .map((s) => s.id);
  if (!ids.length) return { stopped: 0 };

  await prisma.outreachSequence.updateMany({
    where: { id: { in: ids } },
    data: { status: "PAUSED" },
  });
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

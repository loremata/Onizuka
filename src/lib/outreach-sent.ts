import { runReachDraftSentAutomationRules } from "@/lib/automation-rules-run";
import { prisma } from "@/lib/prisma";
import { markSequenceStepSentByDraftId } from "@/lib/outreach-sequence";

/** Segna bozza outreach come inviata (timestamp + sequenza collegata). */
export async function markOutreachDraftSent(
  draftId: string,
  ownerUserId: string,
  opts?: { abVariantSent?: "A" | "B" }
): Promise<boolean> {
  const updated = await prisma.outreachDraft.updateMany({
    where: {
      id: draftId,
      ownerUserId,
      status: { in: ["APPROVED", "PENDING_APPROVAL"] },
    },
    data: {
      status: "SENT",
      sentAt: new Date(),
      ...(opts?.abVariantSent ? { abVariantSent: opts.abVariantSent } : {}),
    },
  });

  if (updated.count === 0) return false;

  await markSequenceStepSentByDraftId(draftId).catch(() => undefined);

  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    select: {
      ownerUserId: true,
      subject: true,
      clientId: true,
      client: { select: { companyName: true } },
    },
  });
  if (draft) {
    void runReachDraftSentAutomationRules(draft.ownerUserId, {
      draftId,
      subject: draft.subject,
      clientId: draft.clientId,
      clientName: draft.client?.companyName ?? null,
    }).catch(() => {});
  }

  return true;
}

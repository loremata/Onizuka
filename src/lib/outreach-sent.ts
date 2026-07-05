import type { CommercialProspectStage } from "@prisma/client";
import { runReachDraftSentAutomationRules } from "@/lib/automation-rules-run";
import { prisma } from "@/lib/prisma";
import { markSequenceStepSentByDraftId } from "@/lib/outreach-sequence";
import { leadLifecycleForStage } from "@/lib/lead-lifecycle";
import { commercialProspectStageOptions } from "@/lib/commercial-prospect-stage";

/**
 * Avanza lo stadio funnel del lead quando una mail parte davvero. Solo IN AVANTI:
 * usa l'ordine di `commercialProspectStageOptions` e non regredisce mai da stadi
 * più avanzati o terminali (WON/LOST/NURTURING hanno indice ≥ target). Il lead è
 * quello collegato alla bozza (leadId) o, per bozze cliente-only, il satellite via
 * clientId. Chiude il buco per cui `FIRST_AUDIT_MAIL_SENT` non veniva mai impostato.
 */
async function advanceLeadStageOnSend(
  leadId: string | null,
  clientId: string | null,
  targetStage: CommercialProspectStage
): Promise<void> {
  const where = leadId ? { id: leadId } : clientId ? { clientId } : null;
  if (!where) return;
  const lead = await prisma.lead.findFirst({
    where,
    select: { id: true, commercialProspectStage: true },
  });
  if (!lead) return;
  const order = commercialProspectStageOptions;
  // Stage nullo = nessuno stadio ancora → curIdx -1, così il target avanza comunque.
  const curIdx = lead.commercialProspectStage
    ? order.indexOf(lead.commercialProspectStage)
    : -1;
  const tgtIdx = order.indexOf(targetStage);
  if (tgtIdx < 0 || tgtIdx <= curIdx) return; // solo avanzamento
  await prisma.lead
    .update({ where: { id: lead.id }, data: leadLifecycleForStage(targetStage) })
    .catch(() => undefined);
}

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
      leadId: true,
      sequenceStepId: true,
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

    // Avanza il funnel del lead: prima mail (step 0 / senza sequenza) → 1ª mail audit
    // inviata; follow-up (step ≥ 1) → follow-up inviato.
    const stepIndex = draft.sequenceStepId
      ? (await prisma.outreachSequenceStep.findUnique({
          where: { id: draft.sequenceStepId },
          select: { stepIndex: true },
        }))?.stepIndex ?? 0
      : 0;
    const targetStage: CommercialProspectStage =
      stepIndex >= 1 ? "FOLLOW_UP_SENT" : "FIRST_AUDIT_MAIL_SENT";
    await advanceLeadStageOnSend(draft.leadId, draft.clientId, targetStage);
  }

  return true;
}

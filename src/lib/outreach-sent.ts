import type { CommercialProspectStage } from "@prisma/client";
import { runReachDraftSentAutomationRules } from "@/lib/automation-rules-run";
import { prisma } from "@/lib/prisma";
import { markSequenceStepSentByDraftId } from "@/lib/outreach-sequence";
import { setLeadStage } from "@/lib/lead-stage";

/**
 * Avanza lo stadio funnel del lead quando una mail parte davvero. Solo IN AVANTI
 * (`onlyForward`): un lead già vinto o perso non torna indietro. Il lead è quello
 * collegato alla bozza (leadId) o, per bozze cliente-only, il satellite via
 * clientId. Chiude il buco per cui `FIRST_AUDIT_MAIL_SENT` non veniva mai impostato.
 * Il passaggio finisce in `LeadStageEvent`: è il momento in cui il contatto esiste.
 */
async function advanceLeadStageOnSend(
  leadId: string | null,
  clientId: string | null,
  targetStage: CommercialProspectStage
): Promise<void> {
  const where = leadId ? { id: leadId } : clientId ? { clientId } : null;
  if (!where) return;
  await setLeadStage({
    where,
    stage: targetStage,
    source: targetStage === "FOLLOW_UP_SENT" ? "outreach:follow-up" : "outreach:prima-mail",
    onlyForward: true,
  }).catch(() => undefined);
}

/** Segna bozza outreach come inviata (timestamp + sequenza collegata). */
export async function markOutreachDraftSent(
  draftId: string,
  ownerUserId: string,
  opts?: { abVariantSent?: "A" | "B"; sentToEmail?: string }
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
      // Destinatario reale: prova di chi ha ricevuto cosa, e base del blocco
      // anti doppio invio verso lo stesso recapito.
      ...(opts?.sentToEmail ? { sentToEmail: opts.sentToEmail.trim().toLowerCase() } : {}),
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

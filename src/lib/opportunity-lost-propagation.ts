import { prisma } from "@/lib/prisma";

export type OpportunityLostResult = {
  clientId: string | null;
  leadNurturing: boolean;
  taskCreated: boolean;
};

const EMPTY: OpportunityLostResult = { clientId: null, leadNurturing: false, taskCreated: false };
const SOURCE = "opportunity_lost";

/** Stadi prospect "pre-vittoria": da qui si può tornare in nurturing. */
const PRE_WIN_STAGES = new Set([
  "PROSPECT_ENTERED",
  "AUDIT_IN_PROGRESS",
  "AUDIT_COMPLETED",
  "REPORT_GENERATED",
  "AWAITING_SEND_APPROVAL",
  "OUTREACH_SENT",
  "QUOTE_SENT",
  "IN_NEGOTIATION",
]);

/**
 * Propaga gli effetti di un'opportunità PERSA (asse LOST, prima morto: la perdita
 * non faceva nulla a valle). Best-effort, non rilancia.
 *  - rimette il lead collegato in NURTURING (se era in una fase pre-vittoria),
 *  - cancella i follow-up pendenti del lead (non ha senso inseguire un deal perso),
 *  - crea un FlowTask di ri-proposta a +30 giorni, così il prospect non si perde.
 */
export async function propagateOpportunityLost(
  opportunityId: string,
  reason?: string | null
): Promise<OpportunityLostResult> {
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        title: true,
        clientId: true,
        leadId: true,
        ownerUserId: true,
        client: { select: { companyName: true } },
        lead: {
          select: { id: true, clientId: true, businessName: true, title: true, commercialProspectStage: true },
        },
      },
    });
    if (!opp) return EMPTY;

    const clientId = opp.clientId ?? opp.lead?.clientId ?? null;
    const name =
      opp.client?.companyName ?? opp.lead?.businessName ?? opp.lead?.title ?? "prospect";
    let leadNurturing = false;

    if (opp.leadId && opp.lead) {
      const stage = opp.lead.commercialProspectStage ?? undefined;
      if (!stage || PRE_WIN_STAGES.has(stage)) {
        await prisma.lead.update({
          where: { id: opp.leadId },
          data: { commercialProspectStage: "NURTURING" },
        });
        leadNurturing = true;
      }
      // Stop inseguimenti su un deal perso.
      await prisma.leadFollowup.updateMany({
        where: { leadId: opp.leadId, outcome: "pending" },
        data: { outcome: "cancelled" },
      });
    }

    // Task di ri-proposta (idempotente per opportunità).
    const title = `Riproponi a ${name} — opportunità persa`;
    const existing = await prisma.flowTask.findFirst({
      where: { ownerUserId: opp.ownerUserId, source: SOURCE, title },
      select: { id: true },
    });
    let taskCreated = false;
    if (!existing) {
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.flowTask.create({
        data: {
          ownerUserId: opp.ownerUserId,
          relatedClientId: clientId ?? undefined,
          source: SOURCE,
          title,
          description: `Opportunità «${opp.title}» persa${reason ? ` (${reason})` : ""}. Rivaluta tra ~1 mese: nuovo bisogno, cambio referente o offerta diversa.`,
          priority: "LOW",
          dueDate,
        },
      });
      taskCreated = true;
    }

    return { clientId, leadNurturing, taskCreated };
  } catch (e) {
    console.error("propagateOpportunityLost failed", e);
    return EMPTY;
  }
}

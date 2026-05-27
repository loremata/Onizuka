import type { AuditMatchKind } from "@/lib/audit-commercial-match";
import { prisma } from "@/lib/prisma";
import { ensureOpportunityFromDigitalAudit } from "@/lib/audit-opportunity-from-audit";
import { createAuditFollowUpTasks } from "@/lib/audit-follow-up";
import { commercialPriorityFromAuditScore } from "@/lib/audit-service-recommendations";

export type WireAuditCommercialCrmParams = {
  ownerUserId: string;
  auditId: string;
  clientId: string;
  leadId?: string;
  clientName: string;
  overallScore: number;
  priorityProblem?: string | null;
  recommendedOffer?: string | null;
  outreachDraftId?: string;
  matchKind?: AuditMatchKind;
  matchWarnings?: string[];
  skipOpportunity?: boolean;
  skipTasks?: boolean;
};

export type WireAuditCommercialCrmResult = {
  opportunityId?: string;
  quoteId?: string;
  taskIds: string[];
  leadId?: string;
};

export async function wireAuditCommercialCrm(
  params: WireAuditCommercialCrmParams
): Promise<WireAuditCommercialCrmResult> {
  let leadId = params.leadId;

  if (leadId) {
    await prisma.digitalAudit.update({
      where: { id: params.auditId },
      data: { leadId },
    });
  } else {
    const linked = await prisma.lead.findFirst({
      where: {
        ownerUserId: params.ownerUserId,
        OR: [{ convertedClientId: params.clientId }, { digitalAudits: { some: { id: params.auditId } } }],
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (linked) {
      leadId = linked.id;
      await prisma.digitalAudit.update({
        where: { id: params.auditId },
        data: { leadId },
      });
    }
  }

  if (leadId && params.matchKind) {
    const stage =
      params.matchKind === "converted_client"
        ? "REPORT_GENERATED"
        : params.overallScore < 50
          ? "AWAITING_SEND_APPROVAL"
          : "REPORT_GENERATED";
    await prisma.lead
      .update({
        where: { id: leadId },
        data: { commercialProspectStage: stage },
      })
      .catch(() => undefined);
  }

  let opportunityId: string | undefined;
  let quoteId: string | undefined;

  if (!params.skipOpportunity) {
    const opp = await ensureOpportunityFromDigitalAudit({
      ownerUserId: params.ownerUserId,
      auditId: params.auditId,
      clientId: params.clientId,
      leadId,
    });
    opportunityId = opp?.opportunityId;
    quoteId = opp?.quoteId;
  }

  const taskIds: string[] = [];
  if (!params.skipTasks) {
    const priority = commercialPriorityFromAuditScore(params.overallScore);
    const contactDue =
      priority === "URGENT" || priority === "HIGH"
        ? addHours(new Date(), 24)
        : addHours(new Date(), 48);

    const created = await createAuditFollowUpTasks({
      ownerUserId: params.ownerUserId,
      clientId: params.clientId,
      clientName: params.clientName,
      auditId: params.auditId,
      outreachDraftId: params.outreachDraftId,
      priorityProblem: params.priorityProblem,
      recommendedOffer: params.recommendedOffer,
      opportunityId,
      contactDue,
      matchKind: params.matchKind,
    });
    taskIds.push(...created);
  }

  return { opportunityId, quoteId, taskIds, leadId };
}

function addHours(d: Date, h: number): Date {
  const out = new Date(d);
  out.setTime(out.getTime() + h * 60 * 60 * 1000);
  return out;
}

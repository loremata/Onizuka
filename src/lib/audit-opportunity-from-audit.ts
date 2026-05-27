import type { OpportunityPriority, OpportunityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  commercialPriorityFromAuditScore,
  estimatedValueHintFromScore,
} from "@/lib/audit-service-recommendations";
import { assertOpportunityParty } from "@/lib/opportunity-party";

const OPPORTUNITY_SOURCE_DIGITAL_AUDIT = "DIGITAL_AUDIT";
const OPEN_STATUSES: OpportunityStatus[] = ["OPEN", "PAUSED"];

function mapCommercialPriority(score: number): OpportunityPriority {
  const p = commercialPriorityFromAuditScore(score);
  if (p === "URGENT" || p === "HIGH") return "HIGH";
  if (p === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function probabilityFromScore(score: number): number {
  if (score < 35) return 55;
  if (score < 50) return 45;
  if (score < 65) return 35;
  return 25;
}

export type EnsureOpportunityFromAuditResult = {
  opportunityId: string;
  quoteId?: string;
  created: boolean;
  updated: boolean;
};

function partyWhere(params: {
  ownerUserId: string;
  clientId?: string | null;
  leadId?: string | null;
}) {
  const or: { clientId?: string; leadId?: string }[] = [];
  if (params.clientId) or.push({ clientId: params.clientId });
  if (params.leadId) or.push({ leadId: params.leadId });
  return or.length ? { ownerUserId: params.ownerUserId, OR: or } : { ownerUserId: params.ownerUserId };
}

/**
 * Crea o aggiorna opportunity post-audit (CM-01/AP-02). Dedupe: auditId, lead/client + servizio aperto.
 */
export async function ensureOpportunityFromDigitalAudit(params: {
  ownerUserId: string;
  auditId: string;
  clientId?: string | null;
  leadId?: string | null;
}): Promise<EnsureOpportunityFromAuditResult | null> {
  const partyError = assertOpportunityParty(params);
  if (partyError) return null;

  const audit = await prisma.digitalAudit.findFirst({
    where: { id: params.auditId, ownerUserId: params.ownerUserId },
    include: {
      recommendedService: { select: { id: true, name: true, slug: true } },
      recommendedBrand: { select: { name: true } },
      client: { select: { companyName: true } },
      lead: { select: { businessName: true, title: true } },
      sections: { select: { sectionKey: true, score: true } },
    },
  });
  if (!audit?.recommendedService) return null;

  const clientId = params.clientId ?? audit.clientId ?? undefined;
  const leadId = params.leadId ?? audit.leadId ?? undefined;
  if (!clientId && !leadId) return null;

  const score = audit.overallScore ?? 50;
  const valueHint = estimatedValueHintFromScore(score);
  const priority = mapCommercialPriority(score);
  const serviceName = audit.recommendedService.name;
  const serviceSlug = audit.recommendedService.slug;
  const brandName = audit.recommendedBrand?.name ?? "digitale";
  const company =
    audit.client?.companyName ??
    audit.businessName ??
    audit.lead?.businessName ??
    audit.lead?.title ??
    "prospect";

  const criticalSections = [...audit.sections]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => `${s.sectionKey}:${s.score}`)
    .join(", ");

  const description = [
    `Fonte: audit digitale ${params.auditId}`,
    audit.priorityProblem ? `Criticità: ${audit.priorityProblem}` : null,
    criticalSections ? `Sezioni deboli: ${criticalSections}` : null,
    `Servizio consigliato: ${serviceName} (${serviceSlug})`,
    `Valore stimato: ${valueHint}`,
    leadId ? `Lead: ${leadId}` : null,
    clientId ? `Client: ${clientId}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const nextAction = `Contatto commerciale post-audit · proposta ${serviceName}`;

  const byAudit = await prisma.opportunity.findFirst({
    where: { ownerUserId: params.ownerUserId, digitalAuditId: params.auditId },
    orderBy: { updatedAt: "desc" },
  });
  if (byAudit) {
    if (byAudit.status === "WON" || byAudit.status === "LOST") {
      return {
        opportunityId: byAudit.id,
        created: false,
        updated: false,
      };
    }
    await prisma.opportunity.update({
      where: { id: byAudit.id },
      data: {
        description,
        priority,
        probability: probabilityFromScore(score),
        nextAction,
        leadId: leadId ?? byAudit.leadId,
        clientId: clientId ?? byAudit.clientId,
      },
    });
    const quote = await ensureDraftQuoteForOpportunity({
      ownerUserId: params.ownerUserId,
      opportunityId: byAudit.id,
      auditId: params.auditId,
      serviceName,
    });
    return {
      opportunityId: byAudit.id,
      quoteId: quote?.id,
      created: false,
      updated: true,
    };
  }

  const openSameService = await prisma.opportunity.findFirst({
    where: {
      ...partyWhere({ ownerUserId: params.ownerUserId, clientId, leadId }),
      status: { in: OPEN_STATUSES },
      source: OPPORTUNITY_SOURCE_DIGITAL_AUDIT,
      OR: [
        { description: { contains: serviceSlug, mode: "insensitive" } },
        { title: { contains: serviceName, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  if (openSameService) {
    await prisma.opportunity.update({
      where: { id: openSameService.id },
      data: {
        digitalAuditId: params.auditId,
        description,
        priority,
        probability: probabilityFromScore(score),
        nextAction,
        leadId: leadId ?? openSameService.leadId,
        clientId: clientId ?? openSameService.clientId,
      },
    });
    const quote = await ensureDraftQuoteForOpportunity({
      ownerUserId: params.ownerUserId,
      opportunityId: openSameService.id,
      auditId: params.auditId,
      serviceName,
    });
    return {
      opportunityId: openSameService.id,
      quoteId: quote?.id,
      created: false,
      updated: true,
    };
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      clientId: clientId ?? null,
      leadId: leadId ?? null,
      ownerUserId: params.ownerUserId,
      title: `Audit · ${brandName} · ${company}`,
      description,
      status: "OPEN",
      source: OPPORTUNITY_SOURCE_DIGITAL_AUDIT,
      digitalAuditId: params.auditId,
      priority,
      probability: probabilityFromScore(score),
      nextAction,
    },
  });

  const quote = await ensureDraftQuoteForOpportunity({
    ownerUserId: params.ownerUserId,
    opportunityId: opportunity.id,
    auditId: params.auditId,
    serviceName,
  });

  return {
    opportunityId: opportunity.id,
    quoteId: quote?.id,
    created: true,
    updated: false,
  };
}

async function ensureDraftQuoteForOpportunity(params: {
  ownerUserId: string;
  opportunityId: string;
  auditId: string;
  serviceName: string;
}): Promise<{ id: string } | null> {
  const existing = await prisma.opportunityQuote.findFirst({
    where: {
      ownerUserId: params.ownerUserId,
      opportunityId: params.opportunityId,
      status: "DRAFT",
      notes: { contains: params.auditId },
    },
  });
  if (existing) return { id: existing.id };

  const linesJson = JSON.stringify([
    {
      description: `${params.serviceName} — proposta post audit digitale`,
      quantity: 1,
      unitPrice: 0,
    },
  ]);

  const quote = await prisma.opportunityQuote.create({
    data: {
      opportunityId: params.opportunityId,
      ownerUserId: params.ownerUserId,
      title: `Preventivo audit · ${params.serviceName}`,
      status: "DRAFT",
      linesJson,
      notes: `Bozza automatica da audit ${params.auditId}. Completa importi e invia da Approval Queue.`,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return { id: quote.id };
}

/** Collega opportunity esistenti al client dopo conversione lead. */
export async function syncOpportunitiesOnLeadConversion(leadId: string, clientId: string): Promise<number> {
  const result = await prisma.opportunity.updateMany({
    where: { leadId },
    data: { clientId },
  });
  return result.count;
}

/** @deprecated Usa ensureOpportunityFromDigitalAudit */
export async function ensureDraftQuoteFromDigitalAudit(params: {
  ownerUserId: string;
  clientId: string;
  auditId: string;
  leadId?: string;
}): Promise<{ quoteId: string; opportunityId: string } | null> {
  const result = await ensureOpportunityFromDigitalAudit(params);
  if (!result?.quoteId) {
    if (result) return { quoteId: "", opportunityId: result.opportunityId };
    return null;
  }
  return { quoteId: result.quoteId, opportunityId: result.opportunityId };
}

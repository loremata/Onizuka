import { prisma } from "@/lib/prisma";
import { digitalAuditSectionLabel } from "@/lib/digital-audit-labels";
import { AUDIT_SECTION_RECOMMENDATIONS } from "@/lib/audit-service-recommendations";

export type AuditCommercialSummary = {
  audits: {
    id: string;
    overallScore: number | null;
    priorityProblem: string | null;
    createdAt: Date;
    recommendedService: string | null;
    href: string;
  }[];
  opportunities: {
    id: string;
    title: string;
    status: string;
    priority: string;
    nextAction: string | null;
    href: string;
  }[];
  tasks: {
    id: string;
    title: string;
    dueDate: Date | null;
    status: string;
    href: string;
  }[];
  latestScore: number | null;
  mainCriticality: string | null;
  recommendedServices: string[];
  nextStep: string | null;
};

export async function loadAuditCommercialSummaryForClient(
  clientId: string,
  ownerUserId: string
): Promise<AuditCommercialSummary> {
  const [audits, opportunities, tasks] = await Promise.all([
    prisma.digitalAudit.findMany({
      where: { clientId, ownerUserId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        overallScore: true,
        priorityProblem: true,
        createdAt: true,
        recommendedService: { select: { name: true } },
        sections: { select: { sectionKey: true, score: true }, orderBy: { score: "asc" }, take: 1 },
      },
    }),
    prisma.opportunity.findMany({
      where: { clientId, ownerUserId, source: "DIGITAL_AUDIT" },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, status: true, priority: true, nextAction: true },
    }),
    prisma.flowTask.findMany({
      where: { relatedClientId: clientId, ownerUserId, source: "audit", status: { not: "DONE" } },
      orderBy: { dueDate: "asc" },
      take: 8,
      select: { id: true, title: true, dueDate: true, status: true },
    }),
  ]);

  const latest = audits[0];
  const weakest = latest?.sections[0];
  const serviceFromSection = weakest
    ? AUDIT_SECTION_RECOMMENDATIONS[weakest.sectionKey]?.serviceLabel
    : null;

  return {
    audits: audits.map((a) => ({
      id: a.id,
      overallScore: a.overallScore,
      priorityProblem: a.priorityProblem,
      createdAt: a.createdAt,
      recommendedService: a.recommendedService?.name ?? null,
      href: `/admin/audit/digital/${a.id}`,
    })),
    opportunities: opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      priority: o.priority,
      nextAction: o.nextAction,
      href: `/admin/crm/opportunities/${o.id}/edit`,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      status: t.status,
      href: `/admin/flow?task=${t.id}`,
    })),
    latestScore: latest?.overallScore ?? null,
    mainCriticality: latest?.priorityProblem ?? (weakest ? digitalAuditSectionLabel[weakest.sectionKey] : null),
    recommendedServices: Array.from(
      new Set([
        ...audits.map((a) => a.recommendedService?.name).filter((x): x is string => Boolean(x)),
        ...(serviceFromSection ? [serviceFromSection] : []),
      ])
    ).slice(0, 5),
    nextStep: opportunities[0]?.nextAction ?? tasks[0]?.title ?? null,
  };
}

export async function loadAuditCommercialSummaryForLead(
  leadId: string,
  ownerUserId: string
): Promise<AuditCommercialSummary | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ownerUserId },
    select: {
      convertedClientId: true,
      source: true,
      commercialProspectStage: true,
      businessName: true,
      title: true,
    },
  });
  if (!lead) return null;

  const clientId = lead.convertedClientId;
  const leadOpportunities = await prisma.opportunity.findMany({
    where: { leadId, ownerUserId },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: { id: true, title: true, status: true, priority: true, nextAction: true },
  });

  const audits = await prisma.digitalAudit.findMany({
    where: clientId ? { OR: [{ leadId }, { clientId }] } : { leadId },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      overallScore: true,
      priorityProblem: true,
      createdAt: true,
      clientId: true,
      recommendedService: { select: { name: true } },
    },
  });

  const effectiveClientId = clientId ?? audits.find((a) => a.clientId)?.clientId;
  const leadTasks = await prisma.flowTask.findMany({
    where: {
      ownerUserId,
      source: "audit",
      status: { not: "DONE" },
      OR: [
        ...(clientId ? [{ relatedClientId: clientId }] : []),
        { description: { contains: leadId } },
      ],
    },
    orderBy: { dueDate: "asc" },
    take: 8,
    select: { id: true, title: true, dueDate: true, status: true },
  });

  const oppRows = (rows: typeof leadOpportunities) =>
    rows.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      priority: o.priority,
      nextAction: o.nextAction,
      href: `/admin/crm/opportunities/${o.id}/edit`,
    }));

  if (effectiveClientId) {
    const base = await loadAuditCommercialSummaryForClient(effectiveClientId, ownerUserId);
    const oppById = new Map<string, (typeof base.opportunities)[0]>();
    for (const o of oppRows(leadOpportunities)) oppById.set(o.id, o);
    for (const o of base.opportunities) if (!oppById.has(o.id)) oppById.set(o.id, o);
    const mergedOpps = Array.from(oppById.values()).slice(0, 6);
    const taskById = new Map<string, (typeof base.tasks)[0]>();
    for (const t of leadTasks.map((x) => ({
      id: x.id,
      title: x.title,
      dueDate: x.dueDate,
      status: x.status,
      href: `/admin/flow?task=${x.id}`,
    })))
      taskById.set(t.id, t);
    for (const t of base.tasks) if (!taskById.has(t.id)) taskById.set(t.id, t);

    return {
      ...base,
      audits: audits.length
        ? audits.map((a) => ({
            id: a.id,
            overallScore: a.overallScore,
            priorityProblem: a.priorityProblem,
            createdAt: a.createdAt,
            recommendedService: a.recommendedService?.name ?? null,
            href: `/admin/audit/digital/${a.id}`,
          }))
        : base.audits,
      opportunities: mergedOpps,
      tasks: Array.from(taskById.values()).slice(0, 8),
      nextStep: base.nextStep ?? leadOpportunities[0]?.nextAction ?? leadTasks[0]?.title ?? null,
    };
  }

  return {
    audits: audits.map((a) => ({
      id: a.id,
      overallScore: a.overallScore,
      priorityProblem: a.priorityProblem,
      createdAt: a.createdAt,
      recommendedService: a.recommendedService?.name ?? null,
      href: `/admin/audit/digital/${a.id}`,
    })),
    opportunities: oppRows(leadOpportunities),
    tasks: leadTasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      status: t.status,
      href: `/admin/flow?task=${t.id}`,
    })),
    latestScore: audits[0]?.overallScore ?? null,
    mainCriticality: audits[0]?.priorityProblem ?? null,
    recommendedServices: audits
      .map((a) => a.recommendedService?.name)
      .filter((x): x is string => Boolean(x)),
    nextStep: leadOpportunities[0]?.nextAction ?? leadTasks[0]?.title ?? null,
  };
}

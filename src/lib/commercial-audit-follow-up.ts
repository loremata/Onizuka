import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const OPEN_TASK = ["TODO", "IN_PROGRESS", "WAITING"] as const;
const COMMERCIAL_TASK_SOURCES = ["audit", "quote_no_response", "sheet_queue"] as const;
/** Outreach inviato o in approvazione negli ultimi N giorni = follow-up attivo. */
const OUTREACH_RECENT_DAYS = 14;

export type AuditFollowUpGapKind =
  | "no_commercial_task"
  | "critical_no_opportunity"
  | "party_no_action"
  | "isolated";

export type AuditFollowUpGapRow = {
  auditId: string;
  title: string;
  score: number | null;
  kind: AuditFollowUpGapKind;
  leadId: string | null;
  clientId: string | null;
  recommendedServiceName: string | null;
};

export type AuditFollowUpSummary = {
  /** Audit completati nel campione senza task commerciale, opp aperta o outreach recente. */
  withoutFollowUpTotal: number;
  noCommercialTask: number;
  criticalNoOpportunity: number;
  partyNoAction: number;
  isolated: number;
  topGaps: AuditFollowUpGapRow[];
  /** Campione analizzato (max 120 audit recenti nel periodo). */
  sampleSize: number;
};

function extractAuditIdFromTaskDescription(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/audit\s+([a-z0-9_-]{10,})/i);
  return m?.[1] ?? null;
}

function recentOutreachSince(): Date {
  const d = new Date();
  d.setDate(d.getDate() - OUTREACH_RECENT_DAYS);
  return d;
}

/**
 * KPI «audit senza follow-up» — analisi su campione recente (no N+1).
 * Un audit ha follow-up se: opportunity OPEN con digitalAuditId, task commerciale
 * aperto (source audit + id in description o stesso clientId), outreach recente
 * (inviato ≤14g o PENDING_APPROVAL) collegato all'audit.
 */
export async function loadAuditFollowUpSummary(
  ownerUserId: string,
  since: Date | null,
  sampleTake = 120
): Promise<AuditFollowUpSummary> {
  const auditBase: Prisma.DigitalAuditWhereInput = {
    ownerUserId,
    status: "COMPLETED",
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const outreachSince = recentOutreachSince();

  const [openOppLinks, openCommercialTasks, recentOutreach, candidateAudits] =
    await Promise.all([
      prisma.opportunity.findMany({
        where: {
          ownerUserId,
          status: "OPEN",
          digitalAuditId: { not: null },
        },
        select: { digitalAuditId: true },
      }),
      prisma.flowTask.findMany({
        where: {
          ownerUserId,
          status: { in: [...OPEN_TASK] },
          source: { in: [...COMMERCIAL_TASK_SOURCES] },
        },
        select: { description: true, relatedClientId: true, source: true },
      }),
      prisma.outreachDraft.findMany({
        where: {
          ownerUserId,
          digitalAuditId: { not: null },
          OR: [
            { status: "PENDING_APPROVAL" },
            { sentAt: { gte: outreachSince } },
          ],
        },
        select: { digitalAuditId: true },
      }),
      prisma.digitalAudit.findMany({
        where: auditBase,
        orderBy: [{ overallScore: "asc" }, { updatedAt: "desc" }],
        take: sampleTake,
        select: {
          id: true,
          businessName: true,
          overallScore: true,
          leadId: true,
          clientId: true,
          recommendedService: { select: { name: true } },
        },
      }),
    ]);

  const oppCovered = new Set(
    openOppLinks.map((o) => o.digitalAuditId).filter((id): id is string => Boolean(id))
  );
  const outreachCovered = new Set(
    recentOutreach.map((o) => o.digitalAuditId).filter((id): id is string => Boolean(id))
  );
  const taskAuditIds = new Set<string>();
  const taskClientIds = new Set<string>();
  for (const t of openCommercialTasks) {
    if (t.source === "audit") {
      const aid = extractAuditIdFromTaskDescription(t.description);
      if (aid) taskAuditIds.add(aid);
      if (t.relatedClientId) taskClientIds.add(t.relatedClientId);
    }
  }

  const hasFollowUp = (a: (typeof candidateAudits)[0]) =>
    oppCovered.has(a.id) ||
    outreachCovered.has(a.id) ||
    taskAuditIds.has(a.id) ||
    (a.clientId != null && taskClientIds.has(a.clientId));

  const gaps: AuditFollowUpGapRow[] = [];

  for (const a of candidateAudits) {
    if (hasFollowUp(a)) continue;

    const isCritical = a.overallScore != null && a.overallScore <= 45;
    const isIsolated = !a.leadId && !a.clientId;
    const hasParty = Boolean(a.leadId || a.clientId);

    let kind: AuditFollowUpGapKind = "no_commercial_task";
    if (isIsolated) kind = "isolated";
    else if (isCritical) kind = "critical_no_opportunity";
    else if (hasParty) kind = "party_no_action";

    gaps.push({
      auditId: a.id,
      title: a.businessName ?? "Audit",
      score: a.overallScore,
      kind,
      leadId: a.leadId,
      clientId: a.clientId,
      recommendedServiceName: a.recommendedService?.name ?? null,
    });
  }

  return {
    withoutFollowUpTotal: gaps.length,
    noCommercialTask: gaps.filter((g) => g.kind === "no_commercial_task").length,
    criticalNoOpportunity: gaps.filter((g) => g.kind === "critical_no_opportunity").length,
    partyNoAction: gaps.filter((g) => g.kind === "party_no_action").length,
    isolated: gaps.filter((g) => g.kind === "isolated").length,
    topGaps: gaps.slice(0, 8),
    sampleSize: candidateAudits.length,
  };
}

export function auditFollowUpRowActions(gap: AuditFollowUpGapRow): {
  href: string;
  actionLabel: string;
  secondaryHref?: string;
  secondaryActionLabel?: string;
} {
  const auditHref = `/admin/audit/digital/${gap.auditId}`;
  if (gap.kind === "isolated") {
    return { href: auditHref, actionLabel: "Apri audit" };
  }
  if (gap.leadId) {
    return {
      href: auditHref,
      actionLabel: "Apri audit",
      secondaryHref: `/admin/crm/leads/${gap.leadId}/edit`,
      secondaryActionLabel: "Apri lead",
    };
  }
  if (gap.clientId) {
    return {
      href: auditHref,
      actionLabel: "Apri audit",
      secondaryHref: `/admin/clients/${gap.clientId}`,
      secondaryActionLabel: "Apri cliente",
    };
  }
  return {
    href: auditHref,
    actionLabel: "Apri audit",
    secondaryHref: "/admin/flow",
    secondaryActionLabel: "Crea task",
  };
}

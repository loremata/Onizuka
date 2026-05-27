import type { OpportunityPriority, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { weightedPipelineEur } from "@/lib/finance-forecast";
import { resolveRecapDayBounds } from "@/lib/day-bounds";
import { loadFinanceOverdueEntries } from "@/lib/finance-overdue";
import { loadUpcomingRetailRenewals } from "@/lib/retail-contract-renewals";
import {
  summarizeCommercialGapsForDashboard,
  loadRecommendedServiceNotProposed,
} from "@/lib/client-commercial-gaps";
import { loadAuditFollowUpSummary, auditFollowUpRowActions } from "@/lib/commercial-audit-follow-up";
import { commercialDashboardScopeNote } from "@/lib/commercial-dashboard-scope";
import {
  type CommercialDashboardFilters,
  periodToSince,
} from "@/lib/commercial-dashboard-filters";

const OPEN_TASK = ["TODO", "IN_PROGRESS", "WAITING"] as const;
const COMMERCIAL_TASK_SOURCES = ["audit", "quote_no_response", "sheet_queue"] as const;

export type CommercialKpiItem = {
  id: string;
  label: string;
  value: number | string;
  hint?: string;
  href: string;
  urgent?: boolean;
};

export type CommercialActionRow = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  actionLabel: string;
  secondaryHref?: string;
  secondaryActionLabel?: string;
};

export type CommercialDashboardData = {
  kpis: CommercialKpiItem[];
  today: CommercialActionRow[];
  opportunities: CommercialActionRow[];
  auditProspecting: CommercialActionRow[];
  clientsMonetization: CommercialActionRow[];
  dataHygiene: CommercialActionRow[];
  renewals30: number;
  renewals60: number;
  renewals90: number;
  pipelineWeightedEur: string;
  filters: CommercialDashboardFilters;
};

function oppPartyName(o: {
  client: { companyName: string } | null;
  lead: { businessName: string | null; title: string } | null;
}): string {
  return o.client?.companyName ?? o.lead?.businessName ?? o.lead?.title ?? "Prospect";
}

export async function loadCommercialDashboard(
  ownerUserId: string,
  userTimeZone: string | null | undefined,
  filters: CommercialDashboardFilters
): Promise<{ ok: true; data: CommercialDashboardData } | { ok: false; reason: "unavailable" }> {
  const since = periodToSince(filters.period);
  const { start: dayStart, end: dayEnd } = resolveRecapDayBounds({ userTimeZone });

  const leadWhere: Prisma.LeadWhereInput = {
    ownerUserId,
    ...(filters.leadStatus ? { status: filters.leadStatus as Prisma.EnumLeadStatusFilter } : {}),
  };

  const oppWhere: Prisma.OpportunityWhereInput = {
    ownerUserId,
    status: "OPEN",
    ...(filters.opportunityPriority
      ? { priority: filters.opportunityPriority as OpportunityPriority }
      : {}),
    ...(filters.opportunitySource ? { source: filters.opportunitySource } : {}),
  };

  const auditWhere: Prisma.DigitalAuditWhereInput = {
    ownerUserId,
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(filters.auditScoreMax != null
      ? { overallScore: { lte: filters.auditScoreMax }, status: "COMPLETED" }
      : {}),
  };

  const result = await runWithDb(async () => {
    const [
      leadsTotal,
      leadsWithoutVat,
      leadsFromAudit,
      clientsReal,
      clientsProspect,
      clientsBusinessProspect,
      clientsPrivateProspect,
      clientsDormant,
      opportunitiesOpen,
      opportunitiesFromAudit,
      opportunitiesLeadOnly,
      opportunitiesHighPriority,
      pipelineRows,
      tasksDueToday,
      tasksOverdue,
      tasksCommercialOpen,
      auditsCompleted,
      auditsHighPotential,
      auditsFailed,
      auditsDomainSheetSkipped,
      outreachPending,
      quotesDraft,
      quotesSentNoResponse,
      opportunitiesNoNextStep,
      tasksNoDueDate,
      auditsNoLead,
      sheetQueuePending,
      opportunitiesOrphan,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({
        where: { ...leadWhere, vatNumber: null, convertedClientId: null },
      }),
      prisma.lead.count({
        where: {
          ...leadWhere,
          OR: [
            { source: { contains: "audit", mode: "insensitive" } },
            { source: { contains: "sheet", mode: "insensitive" } },
            { commercialProspectStage: { not: null } },
            { digitalAudits: { some: {} } },
          ],
        },
      }),
      prisma.client.count({ where: { status: "ACTIVE_CLIENT" } }),
      prisma.client.count({ where: { status: "LEAD_QUALIFIED" } }),
      prisma.client.count({ where: { status: "LEAD_QUALIFIED", kind: "BUSINESS" } }),
      prisma.client.count({ where: { status: "LEAD_QUALIFIED", kind: "PRIVATE" } }),
      prisma.client.count({ where: { status: "DORMANT" } }),
      prisma.opportunity.count({ where: oppWhere }),
      prisma.opportunity.count({
        where: { ...oppWhere, source: "DIGITAL_AUDIT" },
      }),
      prisma.opportunity.count({
        where: { ...oppWhere, clientId: null, leadId: { not: null } },
      }),
      prisma.opportunity.count({
        where: { ...oppWhere, priority: "HIGH" },
      }),
      prisma.opportunity.findMany({
        where: oppWhere,
        select: { estimatedValue: true, priority: true },
      }),
      prisma.flowTask.findMany({
        where: {
          ownerUserId,
          status: { in: [...OPEN_TASK] },
          dueDate: { gte: dayStart, lte: dayEnd },
          source: { in: [...COMMERCIAL_TASK_SOURCES] },
        },
        orderBy: { dueDate: "asc" },
        take: 8,
        select: {
          id: true,
          title: true,
          priority: true,
          relatedClientId: true,
          client: { select: { companyName: true } },
        },
      }),
      prisma.flowTask.count({
        where: {
          ownerUserId,
          status: { in: [...OPEN_TASK] },
          dueDate: { lt: dayStart },
          source: { in: [...COMMERCIAL_TASK_SOURCES] },
        },
      }),
      prisma.flowTask.count({
        where: {
          ownerUserId,
          status: { in: [...OPEN_TASK] },
          source: { in: [...COMMERCIAL_TASK_SOURCES] },
        },
      }),
      prisma.digitalAudit.count({
        where: { ...auditWhere, status: "COMPLETED" },
      }),
      prisma.digitalAudit.count({
        where: {
          ownerUserId,
          status: "COMPLETED",
          overallScore: { lte: 45 },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
      }),
      prisma.digitalAudit.count({
        where: {
          ownerUserId,
          status: "FAILED",
          ...(since ? { createdAt: { gte: since } } : {}),
        },
      }),
      prisma.auditSheetQueueItem.count({
        where: { ownerUserId, status: "SKIPPED", vatNumber: null },
      }),
      prisma.outreachDraft.count({
        where: { ownerUserId, status: "PENDING_APPROVAL" },
      }),
      prisma.opportunityQuote.count({
        where: { ownerUserId, status: "DRAFT" },
      }),
      prisma.opportunityQuote.count({
        where: {
          ownerUserId,
          status: "SENT",
          noResponseDueAt: { lte: new Date() },
        },
      }),
      prisma.opportunity.count({
        where: { ...oppWhere, OR: [{ nextAction: null }, { nextAction: "" }] },
      }),
      prisma.flowTask.count({
        where: {
          ownerUserId,
          status: { in: [...OPEN_TASK] },
          dueDate: null,
          source: { in: [...COMMERCIAL_TASK_SOURCES] },
        },
      }),
      prisma.digitalAudit.count({
        where: {
          ownerUserId,
          leadId: null,
          status: { in: ["COMPLETED", "PENDING", "RUNNING"] },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
      }),
      prisma.auditSheetQueueItem.count({
        where: { ownerUserId, status: "PENDING" },
      }),
      prisma.opportunity.count({
        where: {
          ownerUserId,
          status: "OPEN",
          clientId: null,
          leadId: null,
        },
      }),
    ]);

    const [
      topOpportunities,
      hotLeads,
      recentAudits,
      financeOverdue,
      renewals60,
      commercialGaps,
      auditFollowUp,
      serviceNotProposed,
    ] = await Promise.all([
        prisma.opportunity.findMany({
          where: oppWhere,
          orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
          take: 8,
          select: {
            id: true,
            title: true,
            priority: true,
            nextAction: true,
            estimatedValue: true,
            source: true,
            digitalAuditId: true,
            client: { select: { id: true, companyName: true } },
            lead: { select: { id: true, businessName: true, title: true } },
          },
        }),
        prisma.lead.findMany({
          where: {
            ...leadWhere,
            status: { in: ["QUALIFIED", "CONTACTED"] },
            convertedClientId: null,
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: {
            id: true,
            title: true,
            businessName: true,
            commercialProspectStage: true,
            vatNumber: true,
          },
        }),
        prisma.digitalAudit.findMany({
          where: {
            ownerUserId,
            status: "COMPLETED",
            ...(since ? { createdAt: { gte: since } } : {}),
            ...(filters.auditScoreMax != null ? { overallScore: { lte: filters.auditScoreMax } } : {}),
          },
          orderBy: { overallScore: "asc" },
          take: 6,
          select: {
            id: true,
            businessName: true,
            overallScore: true,
            priorityProblem: true,
            leadId: true,
            clientId: true,
            recommendedService: { select: { name: true } },
          },
        }),
        loadFinanceOverdueEntries(ownerUserId, 5),
        loadUpcomingRetailRenewals(ownerUserId, 90),
        summarizeCommercialGapsForDashboard(ownerUserId, 5),
        loadAuditFollowUpSummary(ownerUserId, since),
        loadRecommendedServiceNotProposed(ownerUserId, since, 6),
      ]);

    const scopeNote = commercialDashboardScopeNote();

    const renewals30 = renewals60.filter((r) => r.daysUntil <= 30).length;
    const renewals90 = renewals60.length;

    const pipelineWeighted = weightedPipelineEur(pipelineRows);

    const kpis: CommercialKpiItem[] = [
      { id: "leads", label: "Lead totali", value: leadsTotal, href: "/admin/crm/leads" },
      {
        id: "leads-audit",
        label: "Prospect da audit",
        value: leadsFromAudit,
        href: "/admin/crm/leads?source=digital_audit",
      },
      {
        id: "clients-real",
        label: "Clienti attivi",
        value: clientsReal,
        href: "/admin/clients?status=ACTIVE_CLIENT",
      },
      {
        id: "clients-prospect",
        label: "Schede prospect (CRM)",
        value: clientsProspect,
        hint: "status LEAD_QUALIFIED",
        href: "/admin/clients?status=LEAD_QUALIFIED",
      },
      {
        id: "prospect-biz",
        label: "Prospect aziende",
        value: clientsBusinessProspect,
        href: "/admin/clients?status=LEAD_QUALIFIED",
      },
      {
        id: "prospect-priv",
        label: "Prospect privati",
        value: clientsPrivateProspect,
        href: "/admin/clients?status=LEAD_QUALIFIED",
      },
      {
        id: "opp-open",
        label: "Opportunità aperte",
        value: opportunitiesOpen,
        href: "/admin/crm/pipeline",
      },
      {
        id: "opp-audit",
        label: "Opportunity da audit",
        value: opportunitiesFromAudit,
        href: "/admin/crm/opportunities?source=DIGITAL_AUDIT",
      },
      {
        id: "opp-lead",
        label: "Opportunity solo lead",
        value: opportunitiesLeadOnly,
        href: "/admin/crm/opportunities",
      },
      {
        id: "opp-high",
        label: "Opportunity priorità alta",
        value: opportunitiesHighPriority,
        urgent: opportunitiesHighPriority > 0,
        href: "/admin/crm/pipeline",
      },
      {
        id: "pipeline",
        label: "Valore pipeline pesato",
        value: `€ ${pipelineWeighted}`,
        href: "/admin/insights/forecast",
      },
      {
        id: "tasks-due",
        label: "Task commerciali in scadenza oggi",
        value: tasksDueToday.length,
        href: "/admin/flow",
      },
      {
        id: "tasks-over",
        label: "Task commerciali scaduti",
        value: tasksOverdue,
        urgent: tasksOverdue > 0,
        href: "/admin/flow?due=overdue",
      },
      {
        id: "audits-done",
        label: "Audit completati",
        value: auditsCompleted,
        href: "/admin/audit/digital",
      },
      {
        id: "audits-hot",
        label: "Audit alto potenziale (≤45)",
        value: auditsHighPotential,
        href: "/admin/audit/digital",
      },
      {
        id: "leads-no-vat",
        label: "Lead senza P.IVA",
        value: leadsWithoutVat,
        urgent: leadsWithoutVat > 0,
        href: "/admin/crm/leads",
      },
      {
        id: "sheet-domain",
        label: "Sheet dominio da revisione",
        value: auditsDomainSheetSkipped,
        href: "/admin/audit/digital",
      },
      {
        id: "quotes-draft",
        label: "Preventivi bozza",
        value: quotesDraft,
        href: "/admin/crm/opportunities",
      },
      {
        id: "outreach",
        label: "Comunicazioni da approvare",
        value: outreachPending,
        href: "/admin/reach",
      },
      {
        id: "dormant",
        label: "Clienti dormienti",
        value: clientsDormant,
        href: "/admin/crm/dormant",
      },
      {
        id: "finance-overdue",
        label: "Incassi scaduti",
        value: financeOverdue.rows.length,
        urgent: financeOverdue.rows.length > 0,
        href: "/admin/finance",
      },
      {
        id: "commercial-gap",
        label: "Clienti con gap servizi",
        value: commercialGaps.totalWithGap,
        hint: `scan max ${commercialGaps.scanLimit} collegati`,
        href: "/admin/crm/cross-sell",
      },
      {
        id: "audit-no-followup",
        label: "Audit senza follow-up",
        value: auditFollowUp.withoutFollowUpTotal,
        hint: `campione ${auditFollowUp.sampleSize} audit`,
        urgent: auditFollowUp.withoutFollowUpTotal > 0,
        href: "/admin/audit/digital",
      },
      {
        id: "service-not-proposed",
        label: "Servizio consigliato non proposto",
        value: serviceNotProposed.length,
        href: "/admin/audit/digital",
      },
    ];

    const today: CommercialActionRow[] = [
      ...tasksDueToday.map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        subtitle: t.client?.companyName ?? "Senza cliente",
        href: "/admin/flow",
        actionLabel: "Apri task",
      })),
      ...(quotesDraft > 0
        ? [
            {
              id: "quotes-draft",
              title: `${quotesDraft} preventivi in bozza`,
              href: "/admin/sales",
              actionLabel: "Vedi preventivi",
            },
          ]
        : []),
      ...(outreachPending > 0
        ? [
            {
              id: "reach-pending",
              title: `${outreachPending} bozze Reach da approvare`,
              href: "/admin/reach",
              actionLabel: "Approva",
            },
          ]
        : []),
      ...(quotesSentNoResponse > 0
        ? [
            {
              id: "quote-noresp",
              title: `${quotesSentNoResponse} preventivi senza risposta`,
              href: "/admin/crm/opportunities",
              actionLabel: "Follow-up",
            },
          ]
        : []),
    ];

    const opportunities: CommercialActionRow[] = topOpportunities.map((o) => ({
      id: o.id,
      title: o.title,
      subtitle: [
        o.client || o.lead ? oppPartyName(o) : "Opportunity orfana",
        o.source === "DIGITAL_AUDIT" ? "da audit" : null,
        o.estimatedValue != null ? `€ ${o.estimatedValue.toString()}` : null,
        o.nextAction ? `→ ${o.nextAction}` : "Senza prossimo step",
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/admin/crm/opportunities/${o.id}/edit`,
      actionLabel: "Apri opportunity",
    }));

    const auditProspecting: CommercialActionRow[] = [
      ...auditFollowUp.topGaps.map((g) => {
        const actions = auditFollowUpRowActions(g);
        return {
          id: `gap-${g.auditId}`,
          title: g.title,
          subtitle: [
            g.score != null ? `Score ${g.score}` : null,
            g.kind === "critical_no_opportunity" ? "Critico · senza opportunity" : null,
            g.kind === "isolated" ? "Scollegato da lead/cliente" : null,
            g.kind === "party_no_action" ? "Con anagrafica · senza azione" : null,
            g.recommendedServiceName ? `Servizio: ${g.recommendedServiceName}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          href: actions.href,
          actionLabel: actions.actionLabel,
          secondaryHref: actions.secondaryHref,
          secondaryActionLabel: actions.secondaryActionLabel,
        };
      }),
      ...serviceNotProposed.map((s) => ({
        id: `svc-${s.auditId}`,
        title: s.businessName,
        subtitle: `Servizio consigliato: ${s.serviceName} · non in pipeline`,
        href: `/admin/audit/digital/${s.auditId}`,
        actionLabel: "Apri audit",
        secondaryHref: s.leadId
          ? `/admin/crm/leads/${s.leadId}/edit`
          : s.clientId
            ? `/admin/clients/${s.clientId}`
            : "/admin/crm/opportunities/new",
        secondaryActionLabel: s.leadId || s.clientId ? "Anagrafica" : "Nuova opp.",
      })),
      ...recentAudits.map((a) => ({
        id: a.id,
        title: a.businessName ?? "Audit",
        subtitle: [
          a.overallScore != null ? `Score ${a.overallScore}` : null,
          a.recommendedService?.name ? `Servizio: ${a.recommendedService.name}` : null,
          a.priorityProblem?.slice(0, 60),
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/admin/audit/digital/${a.id}`,
        actionLabel: "Apri audit",
      })),
      ...hotLeads.map((l) => ({
        id: l.id,
        title: l.businessName ?? l.title,
        subtitle: [
          l.commercialProspectStage ?? "lead",
          l.vatNumber ? null : "P.IVA mancante",
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/admin/crm/leads/${l.id}/edit`,
        actionLabel: "Apri lead",
      })),
    ];

    const clientsMonetization: CommercialActionRow[] = [
      ...commercialGaps.top.map((u) => ({
        id: u.clientId,
        title: u.companyName,
        subtitle: `${u.missingCount} servizi non attivi nel catalogo`,
        href: `/admin/clients/${u.clientId}`,
        actionLabel: "Up-sell",
        secondaryHref: "/admin/crm/opportunities/new",
        secondaryActionLabel: "Nuova opp.",
      })),
      ...financeOverdue.rows.map((f) => ({
        id: f.id,
        title: f.label,
        subtitle: `${f.clientName ?? "—"} · € ${f.amountEur}`,
        href: "/admin/finance",
        actionLabel: "Incasso",
      })),
      ...renewals60.slice(0, 5).map((r) => ({
        id: r.id,
        title: `${r.clientName} · ${r.label}`,
        subtitle: `Rinnovo tra ${r.daysUntil} gg`,
        href: r.href,
        actionLabel: "Scheda cliente",
      })),
    ];

    const dataHygiene: CommercialActionRow[] = [
      ...(opportunitiesOrphan > 0
        ? [
            {
              id: "hygiene-opp-orphan",
              title: `${opportunitiesOrphan} opportunity orfane (senza lead/cliente)`,
              href: "/admin/crm/opportunities",
              actionLabel: "Revisiona opportunity",
            },
          ]
        : []),
      ...(leadsWithoutVat > 0
        ? [
            {
              id: "hygiene-vat",
              title: `${leadsWithoutVat} lead senza P.IVA`,
              href: "/admin/crm/leads",
              actionLabel: "Completa dati",
            },
          ]
        : []),
      ...(opportunitiesNoNextStep > 0
        ? [
            {
              id: "hygiene-opp",
              title: `${opportunitiesNoNextStep} opportunity senza next step`,
              href: "/admin/crm/pipeline",
              actionLabel: "Pipeline",
            },
          ]
        : []),
      ...(tasksNoDueDate > 0
        ? [
            {
              id: "hygiene-task",
              title: `${tasksNoDueDate} task commerciali senza scadenza`,
              href: "/admin/flow",
              actionLabel: "Flow",
            },
          ]
        : []),
      ...(auditsNoLead > 0
        ? [
            {
              id: "hygiene-audit-lead",
              title: `${auditsNoLead} audit senza lead collegato`,
              href: "/admin/audit/digital",
              actionLabel: "Audit",
            },
          ]
        : []),
      ...(sheetQueuePending > 0
        ? [
            {
              id: "hygiene-sheet",
              title: `${sheetQueuePending} righe sheet in coda`,
              href: "/admin/audit/digital",
              actionLabel: "Coda sheet",
            },
          ]
        : []),
      {
        id: "hygiene-dedupe",
        title: "Controllo duplicati CRM",
        href: "/admin/crm/dedupe",
        actionLabel: "Dedupe",
      },
    ];

    if (auditsFailed > 0) {
      kpis.push({
        id: "audits-failed",
        label: "Audit falliti / parziali",
        value: auditsFailed,
        urgent: true,
        href: "/admin/audit/digital",
      });
    }

    if (tasksCommercialOpen > 0) {
      kpis.push({
        id: "tasks-commercial",
        label: "Task commerciali aperti",
        value: tasksCommercialOpen,
        href: "/admin/flow",
      });
    }

    if (opportunitiesOrphan > 0) {
      kpis.push({
        id: "opp-orphan",
        label: "Opportunity orfane",
        value: opportunitiesOrphan,
        urgent: true,
        href: "/admin/crm/opportunities",
      });
    }

    void scopeNote;

    const incompleteKpiIds = [
      "leads-no-vat",
      "sheet-domain",
      "tasks-over",
      "finance-overdue",
      "opp-high",
      "audit-no-followup",
      "opp-orphan",
      "commercial-gap",
      "service-not-proposed",
    ];

    return {
      kpis: filters.incompleteOnly
        ? kpis.filter(
            (k) =>
              k.urgent ||
              (typeof k.value === "number" && k.value > 0 && incompleteKpiIds.includes(k.id))
          )
        : kpis,
      today,
      opportunities,
      auditProspecting,
      clientsMonetization,
      dataHygiene,
      renewals30,
      renewals60: renewals60.filter((r) => r.daysUntil <= 60).length,
      renewals90,
      pipelineWeightedEur: pipelineWeighted,
      filters,
    };
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };
  return { ok: true, data: result.data };
}

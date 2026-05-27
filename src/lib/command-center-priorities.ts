import { loadInsightsStats } from "@/lib/insights-stats";
import { buildInsightRecommendations } from "@/lib/insights-recommendations";
import { loadClientsWithUpsellPotential } from "@/lib/client-commercial-gaps";
import { loadFinanceLedgerStats, FINANCE_MONTHLY_TARGET_EUR } from "@/lib/finance-ledger-stats";
import { prisma } from "@/lib/prisma";
import { loadFinanceReconciliation } from "@/lib/finance-reconciliation";
import { buildFinanceReconciliationRecommendations } from "@/lib/finance-reconciliation-insights";
import { getLeadPipelineBottlenecks } from "@/lib/lead-pipeline-bottleneck";
import { getDormantClients } from "@/lib/dormant-reactivation";
import { getOpportunityPipelineBottlenecks } from "@/lib/opportunity-pipeline-bottleneck";

export type CommandPriority = {
  id: string;
  title: string;
  detail: string;
  href: string;
  priority: "high" | "medium" | "low";
};

export async function loadCommandCenterPriorities(
  ownerId: string,
  userTimeZone: string | null | undefined
): Promise<CommandPriority[]> {
  const [insights, ledger, upsell, outreachPending, financeRecon, bottlenecks, dormant, oppBottlenecks] =
    await Promise.all([
      loadInsightsStats(ownerId, userTimeZone),
      loadFinanceLedgerStats(ownerId),
      loadClientsWithUpsellPotential(3),
      prisma.outreachDraft.count({ where: { ownerUserId: ownerId, status: "PENDING_APPROVAL" } }),
      loadFinanceReconciliation(ownerId),
      getLeadPipelineBottlenecks(ownerId, 2),
      getDormantClients(ownerId, 2),
      getOpportunityPipelineBottlenecks(ownerId, 2),
    ]);

  const out: CommandPriority[] = [];

  if (insights.ok) {
    const recs = buildInsightRecommendations({
      ...insights.stats,
      outreachPending,
    });
    for (const r of recs.slice(0, 4)) {
      out.push({ id: r.id, title: r.title, detail: r.detail, href: r.href, priority: r.priority });
    }
  }

  if (financeRecon.ok && !financeRecon.report.healthy) {
    for (const r of buildFinanceReconciliationRecommendations(financeRecon.report).slice(0, 2)) {
      out.push({ id: r.id, title: r.title, detail: r.detail, href: r.href, priority: r.priority });
    }
  }

  if (ledger.ok && ledger.stats.overdueCount > 0) {
    out.push({
      id: "finance-overdue",
      title: "Incassi o pagamenti scaduti",
      detail: `${ledger.stats.overdueCount} voci finance oltre scadenza — aggiorna stato in Finance.`,
      href: "/admin/finance",
      priority: "high",
    });
  }

  if (ledger.ok) {
    const gap = Number(ledger.stats.gapToTargetEur.replace(/\./g, "").replace(",", "."));
    if (!Number.isNaN(gap) && gap > 500) {
      out.push({
        id: "finance-target",
        title: "Recupera gap cashflow mensile",
        detail: `Netto stimato sotto target € ${FINANCE_MONTHLY_TARGET_EUR.toLocaleString("it-IT")} (gap € ${ledger.stats.gapToTargetEur}).`,
        href: "/admin/finance",
        priority: "high",
      });
    }
  }

  if (upsell[0]) {
    out.push({
      id: "upsell-top",
      title: `Upsell: ${upsell[0].companyName}`,
      detail: `${upsell[0].missingCount} servizi del catalogo non attivi — apri scheda e propone pacchetto.`,
      href: `/admin/clients/${upsell[0].clientId}`,
      priority: "medium",
    });
  }

  if (bottlenecks[0]) {
    out.push({
      id: `bottleneck-${bottlenecks[0].leadId}`,
      title: `Lead in stallo: ${bottlenecks[0].businessName ?? bottlenecks[0].title}`,
      detail: bottlenecks[0].reason,
      href: "/admin/crm/leads",
      priority: bottlenecks[0].priorityScore >= 70 ? "high" : "medium",
    });
  }

  if (dormant[0]) {
    out.push({
      id: `dormant-${dormant[0].clientId}`,
      title: `Riattiva ${dormant[0].companyName}`,
      detail: dormant[0].reason,
      href: `/admin/clients/${dormant[0].clientId}`,
      priority: "medium",
    });
  }

  if (oppBottlenecks[0]) {
    out.push({
      id: `opp-sla-${oppBottlenecks[0].opportunityId}`,
      title: `Opportunità in stallo: ${oppBottlenecks[0].title}`,
      detail: oppBottlenecks[0].reason,
      href: "/admin/crm/opportunity-bottlenecks",
      priority: oppBottlenecks[0].priorityScore >= 70 ? "high" : "medium",
    });
  }

  const seen = new Set<string>();
  const unique = out.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const order = { high: 0, medium: 1, low: 2 };
  return unique.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 3);
}

import type { FinanceReconciliationReport } from "@/lib/finance-reconciliation";
import type { InsightRecommendation } from "@/lib/insights-recommendations";

export function buildFinanceReconciliationRecommendations(
  report: FinanceReconciliationReport
): InsightRecommendation[] {
  if (report.healthy) return [];

  return report.rows
    .filter((r) => r.severity !== "ok" && r.count > 0)
    .map((r) => ({
      id: `finance-recon-${r.id}`,
      title: r.label,
      detail: r.hint ?? `${r.count} voci da correggere in Finance.`,
      href: "/admin/finance",
      priority: r.severity === "issue" ? ("high" as const) : ("medium" as const),
    }));
}

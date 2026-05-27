import { prisma } from "@/lib/prisma";
import { loadFinanceLedgerStats } from "@/lib/finance-ledger-stats";
import { loadFinanceStats } from "@/lib/finance-stats";
import type { FinanceSummaryPdfInput } from "@/lib/finance-pdf";

export async function loadFinanceSummaryPdfInput(
  ownerUserId: string
): Promise<FinanceSummaryPdfInput | null> {
  const [ledger, pipeline, overdue] = await Promise.all([
    loadFinanceLedgerStats(ownerUserId),
    loadFinanceStats(ownerUserId),
    prisma.financeEntry.findMany({
      where: { ownerUserId, status: "OVERDUE" },
      orderBy: { dueDate: "asc" },
      take: 25,
      include: { client: { select: { companyName: true } } },
    }),
  ]);

  if (!ledger.ok || !pipeline.ok) return null;

  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short" });
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date());

  return {
    monthLabel,
    ledger: ledger.stats,
    pipelineOpenEur: pipeline.stats.pipelineOpenEur,
    pipelineWeightedEur: pipeline.stats.pipelineWeightedEur,
    overdueRows: overdue.map((e) => ({
      label: e.label,
      amountEur: Number(e.amountEur.toString()).toLocaleString("it-IT", { minimumFractionDigits: 2 }),
      clientName: e.client?.companyName ?? null,
      dueDate: e.dueDate ? dateFmt.format(e.dueDate) : "",
    })),
  };
}

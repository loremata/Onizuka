import { prisma } from "@/lib/prisma";
import { syncFinanceOverdueStatuses } from "@/lib/finance-overdue";
import { runWithDb } from "@/lib/with-db";

/** Target mensile netto dalla master spec (€). */
export const FINANCE_MONTHLY_TARGET_EUR = 5000;
export const FINANCE_LONG_TERM_TARGET_EUR = 10000;

export type FinanceLedgerStats = {
  monthIncomeExpectedEur: string;
  monthIncomeReceivedEur: string;
  monthExpenseExpectedEur: string;
  monthExpensePaidEur: string;
  monthNetForecastEur: string;
  gapToTargetEur: string;
  overdueCount: number;
  entryCount: number;
};

function sumAmount(
  rows: { amountEur: { toString: () => string } }[]
): number {
  let total = 0;
  for (const r of rows) {
    const n = Number(r.amountEur.toString());
    if (!Number.isNaN(n)) total += n;
  }
  return total;
}

function formatEur(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function loadFinanceLedgerStats(
  ownerId: string
): Promise<{ ok: true; stats: FinanceLedgerStats } | { ok: false; reason: "unavailable" }> {
  const result = await runWithDb(async () => {
    await syncFinanceOverdueStatuses(ownerId);
    const { start, end } = monthBounds();
    const inMonth = {
      OR: [
        { dueDate: { gte: start, lte: end } },
        { paidAt: { gte: start, lte: end } },
        { AND: [{ dueDate: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    };

    const entries = await prisma.financeEntry.findMany({
      where: { ownerUserId: ownerId, ...inMonth },
      select: { type: true, status: true, amountEur: true },
    });

    const incomeExpected = sumAmount(
      entries.filter((e) => e.type === "INCOME" && ["PLANNED", "EXPECTED", "OVERDUE"].includes(e.status))
    );
    const incomeReceived = sumAmount(
      entries.filter((e) => e.type === "INCOME" && e.status === "RECEIVED")
    );
    const expenseExpected = sumAmount(
      entries.filter((e) => e.type === "EXPENSE" && ["PLANNED", "EXPECTED", "OVERDUE"].includes(e.status))
    );
    const expensePaid = sumAmount(
      entries.filter((e) => e.type === "EXPENSE" && e.status === "PAID")
    );

    const netForecast = incomeExpected + incomeReceived - expenseExpected - expensePaid;
    const gap = FINANCE_MONTHLY_TARGET_EUR - netForecast;

    const overdueCount = await prisma.financeEntry.count({
      where: { ownerUserId: ownerId, status: "OVERDUE" },
    });

    return {
      monthIncomeExpectedEur: formatEur(incomeExpected),
      monthIncomeReceivedEur: formatEur(incomeReceived),
      monthExpenseExpectedEur: formatEur(expenseExpected),
      monthExpensePaidEur: formatEur(expensePaid),
      monthNetForecastEur: formatEur(netForecast),
      gapToTargetEur: formatEur(gap),
      overdueCount,
      entryCount: entries.length,
    };
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };
  return { ok: true, stats: result.data };
}

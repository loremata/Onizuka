import { prisma } from "@/lib/prisma";
import { syncFinanceOverdueStatuses } from "@/lib/finance-overdue";
import { runWithDb } from "@/lib/with-db";

export type FinanceReconciliationRow = {
  id: string;
  label: string;
  count: number;
  severity: "ok" | "warn" | "issue";
  hint?: string;
};

export type FinanceReconciliationReport = {
  rows: FinanceReconciliationRow[];
  healthy: boolean;
};

/**
 * Coerenza del registro finance. Solo tracking interno: fatturazione, incassi
 * e adempimenti fiscali sono del commercialista, qui si controlla che i dati
 * registrati siano coerenti tra loro (stati vs date di pagamento, scaduti).
 * Anche RECEIVED e PAID vanno trattati insieme (entrambi = incassato).
 */
export async function loadFinanceReconciliation(
  ownerUserId: string
): Promise<{ ok: true; report: FinanceReconciliationReport } | { ok: false }> {
  const result = await runWithDb(async () => {
    await syncFinanceOverdueStatuses(ownerUserId);

    const [receivedNoPaidAt, paidStatusMismatch, overdueIncome, incomeReceivedMonth] =
      await Promise.all([
        prisma.financeEntry.count({
          where: { ownerUserId, status: { in: ["RECEIVED", "PAID"] }, paidAt: null },
        }),
        prisma.financeEntry.count({
          where: {
            ownerUserId,
            type: "INCOME",
            paidAt: { not: null },
            status: { notIn: ["RECEIVED", "PAID"] },
          },
        }),
        prisma.financeEntry.count({
          where: { ownerUserId, type: "INCOME", status: "OVERDUE" },
        }),
        prisma.financeEntry.count({
          where: {
            ownerUserId,
            type: "INCOME",
            status: { in: ["RECEIVED", "PAID"] },
            paidAt: { gte: monthStart() },
          },
        }),
      ]);

    const rows: FinanceReconciliationRow[] = [
      {
        id: "received_no_paid_at",
        label: "Incassate senza data pagamento",
        count: receivedNoPaidAt,
        severity: receivedNoPaidAt > 0 ? "issue" : "ok",
        hint: "Imposta paidAt o verifica import manuale.",
      },
      {
        id: "paid_status_mismatch",
        label: "paidAt valorizzato ma stato non incassato",
        count: paidStatusMismatch,
        severity: paidStatusMismatch > 0 ? "warn" : "ok",
      },
      {
        id: "overdue_income",
        label: "Entrate in scadenza superata",
        count: overdueIncome,
        severity: overdueIncome > 0 ? "warn" : "ok",
      },
      {
        id: "received_month",
        label: "Incassi registrati questo mese",
        count: incomeReceivedMonth,
        severity: "ok",
      },
    ];

    const healthy = rows.every((r) => r.severity === "ok");

    return { rows, healthy };
  });

  if (!result.ok) return { ok: false };
  return { ok: true, report: result.data };
}

function monthStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

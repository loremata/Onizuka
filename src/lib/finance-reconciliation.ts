import { prisma } from "@/lib/prisma";
import { syncFinanceOverdueStatuses } from "@/lib/finance-overdue";
import { isStripeConfigured } from "@/lib/stripe-client";
import { runWithDb } from "@/lib/with-db";

export type FinanceReconciliationRow = {
  id: string;
  label: string;
  count: number;
  severity: "ok" | "warn" | "issue";
  hint?: string;
};

export type FinanceReconciliationReport = {
  stripeEnabled: boolean;
  rows: FinanceReconciliationRow[];
  healthy: boolean;
};

export async function loadFinanceReconciliation(
  ownerUserId: string
): Promise<{ ok: true; report: FinanceReconciliationReport } | { ok: false }> {
  const result = await runWithDb(async () => {
    await syncFinanceOverdueStatuses(ownerUserId);

    const [
      receivedNoPaidAt,
      paidStatusMismatch,
      stripeSessionStillOpen,
      overdueIncome,
      incomeReceivedMonth,
    ] = await Promise.all([
      prisma.financeEntry.count({
        where: { ownerUserId, status: "RECEIVED", paidAt: null },
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
        where: {
          ownerUserId,
          type: "INCOME",
          stripeCheckoutSessionId: { not: null },
          status: { not: "RECEIVED" },
        },
      }),
      prisma.financeEntry.count({
        where: { ownerUserId, type: "INCOME", status: "OVERDUE" },
      }),
      prisma.financeEntry.count({
        where: {
          ownerUserId,
          type: "INCOME",
          status: "RECEIVED",
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
        id: "stripe_open",
        label: "Checkout Stripe avviato, pagamento non registrato",
        count: stripeSessionStillOpen,
        severity: stripeSessionStillOpen > 0 ? "warn" : "ok",
        hint: "Verifica webhook Stripe o segna manualmente come incassato.",
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

    return {
      stripeEnabled: isStripeConfigured(),
      rows,
      healthy,
    };
  });

  if (!result.ok) return { ok: false };
  return { ok: true, report: result.data };
}

function monthStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

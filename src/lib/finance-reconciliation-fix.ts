import { prisma } from "@/lib/prisma";

export type ReconciliationFixId = "received_no_paid_at" | "paid_status_mismatch";

export async function applyFinanceReconciliationFix(
  ownerUserId: string,
  fixId: ReconciliationFixId
): Promise<{ ok: true; fixed: number } | { ok: false; error: string }> {
  if (fixId === "received_no_paid_at") {
    const rows = await prisma.financeEntry.findMany({
      where: { ownerUserId, status: "RECEIVED", paidAt: null },
      select: { id: true, dueDate: true },
    });
    const now = new Date();
    for (const row of rows) {
      await prisma.financeEntry.update({
        where: { id: row.id },
        data: { paidAt: row.dueDate ?? now },
      });
    }
    return { ok: true, fixed: rows.length };
  }

  if (fixId === "paid_status_mismatch") {
    const [income, expense] = await Promise.all([
      prisma.financeEntry.updateMany({
        where: {
          ownerUserId,
          type: "INCOME",
          paidAt: { not: null },
          status: { notIn: ["RECEIVED", "PAID"] },
        },
        data: { status: "RECEIVED" },
      }),
      prisma.financeEntry.updateMany({
        where: {
          ownerUserId,
          type: "EXPENSE",
          paidAt: { not: null },
          status: { notIn: ["RECEIVED", "PAID"] },
        },
        data: { status: "PAID" },
      }),
    ]);
    return { ok: true, fixed: income.count + expense.count };
  }

  return { ok: false, error: "Correzione non riconosciuta." };
}

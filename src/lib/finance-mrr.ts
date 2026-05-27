import { prisma } from "@/lib/prisma";

/** Somma importi delle entrate flaggate come ricorrenti mensili (MRR indicativo). */
export async function loadOwnerRecurringMrrEur(ownerUserId: string): Promise<{ sumEur: number; count: number }> {
  const rows = await prisma.financeEntry.findMany({
    where: {
      ownerUserId,
      type: "INCOME",
      recurringMonthly: true,
      status: { in: ["PLANNED", "EXPECTED", "RECEIVED", "PAID", "OVERDUE"] },
    },
    select: { amountEur: true },
  });
  let sumEur = 0;
  for (const r of rows) {
    sumEur += Number(r.amountEur.toString());
  }
  return { sumEur, count: rows.length };
}

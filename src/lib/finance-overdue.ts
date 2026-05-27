import { prisma } from "@/lib/prisma";

const OPEN_FINANCE_STATUSES = ["PLANNED", "EXPECTED"] as const;

/** Segna come OVERDUE le voci con scadenza passata ancora aperte. */
export async function syncFinanceOverdueStatuses(ownerUserId?: string): Promise<number> {
  const now = new Date();
  const result = await prisma.financeEntry.updateMany({
    where: {
      ...(ownerUserId ? { ownerUserId } : {}),
      dueDate: { lt: now },
      status: { in: [...OPEN_FINANCE_STATUSES] },
    },
    data: { status: "OVERDUE" },
  });
  return result.count;
}

export type FinanceOverdueRow = {
  id: string;
  label: string;
  type: "INCOME" | "EXPENSE";
  amountEur: string;
  dueDate: Date | null;
  clientName: string | null;
};

export async function loadFinanceOverdueEntries(
  ownerUserId: string,
  limit = 15
): Promise<{ rows: FinanceOverdueRow[]; totalEur: number }> {
  await syncFinanceOverdueStatuses(ownerUserId);

  const entries = await prisma.financeEntry.findMany({
    where: { ownerUserId, status: "OVERDUE" },
    orderBy: { dueDate: "asc" },
    take: limit,
    include: { client: { select: { companyName: true } } },
  });

  let totalEur = 0;
  const rows: FinanceOverdueRow[] = entries.map((e) => {
    const amount = Number(e.amountEur.toString());
    if (!Number.isNaN(amount)) {
      totalEur += e.type === "INCOME" ? amount : -amount;
    }
    return {
      id: e.id,
      label: e.label,
      type: e.type,
      amountEur: amount.toLocaleString("it-IT", { minimumFractionDigits: 2 }),
      dueDate: e.dueDate,
      clientName: e.client?.companyName ?? null,
    };
  });

  return { rows, totalEur };
}

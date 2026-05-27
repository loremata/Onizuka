import { prisma } from "@/lib/prisma";

export type ClientRevenueRow = {
  clientId: string;
  companyName: string;
  totalEur: string;
  entryCount: number;
};

function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Entrate per cliente nel mese corrente (incassate + attese). */
export async function loadFinanceRevenueByClient(
  ownerUserId: string,
  limit = 8
): Promise<ClientRevenueRow[]> {
  const { start, end } = monthBounds();

  const entries = await prisma.financeEntry.findMany({
    where: {
      ownerUserId,
      type: "INCOME",
      clientId: { not: null },
      status: { in: ["EXPECTED", "RECEIVED", "OVERDUE", "PLANNED"] },
      OR: [
        { dueDate: { gte: start, lte: end } },
        { paidAt: { gte: start, lte: end } },
        { AND: [{ dueDate: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    },
    include: { client: { select: { id: true, companyName: true } } },
  });

  const byClient = new Map<string, { name: string; total: number; count: number }>();
  for (const e of entries) {
    if (!e.clientId || !e.client) continue;
    const amount = Number(e.amountEur.toString());
    if (Number.isNaN(amount)) continue;
    const cur = byClient.get(e.clientId) ?? { name: e.client.companyName, total: 0, count: 0 };
    cur.total += amount;
    cur.count += 1;
    byClient.set(e.clientId, cur);
  }

  return Array.from(byClient.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([clientId, v]) => ({
      clientId,
      companyName: v.name,
      totalEur: v.total.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      entryCount: v.count,
    }));
}

import { prisma } from "@/lib/prisma";

export type AssetRevenueRow = {
  assetId: string;
  assetName: string;
  platform: string | null;
  clientName: string;
  totalEur: string;
  entryCount: number;
};

function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Entrate per asset (canale) nel mese corrente. */
export async function loadFinanceRevenueByAsset(
  ownerUserId: string,
  limit = 10
): Promise<AssetRevenueRow[]> {
  const { start, end } = monthBounds();

  const entries = await prisma.financeEntry.findMany({
    where: {
      ownerUserId,
      type: "INCOME",
      assetId: { not: null },
      status: { in: ["EXPECTED", "RECEIVED", "OVERDUE", "PLANNED"] },
      OR: [
        { dueDate: { gte: start, lte: end } },
        { paidAt: { gte: start, lte: end } },
        { AND: [{ dueDate: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    },
    include: {
      asset: { select: { id: true, name: true, platform: true } },
      client: { select: { companyName: true } },
    },
  });

  const byAsset = new Map<string, AssetRevenueRow & { total: number }>();
  for (const e of entries) {
    if (!e.assetId || !e.asset) continue;
    const amount = Number(e.amountEur.toString());
    if (Number.isNaN(amount)) continue;
    const cur = byAsset.get(e.assetId) ?? {
      assetId: e.assetId,
      assetName: e.asset.name,
      platform: e.asset.platform,
      clientName: e.client?.companyName ?? "—",
      totalEur: "0",
      entryCount: 0,
      total: 0,
    };
    cur.total += amount;
    cur.entryCount += 1;
    byAsset.set(e.assetId, cur);
  }

  return Array.from(byAsset.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map(({ total, ...row }) => ({
      ...row,
      totalEur: total.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    }));
}

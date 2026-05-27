import { prisma } from "@/lib/prisma";
import { weightedPipelineEur } from "@/lib/finance-forecast";
import { runWithDb } from "@/lib/with-db";

export type FinanceStats = {
  pipelineOpenEur: string;
  pipelineWeightedEur: string;
  pipelineWonEur: string;
  openCount: number;
  wonCount: number;
  lostCount: number;
};

function sumDecimal(
  rows: { estimatedValue: { toString: () => string } | null }[]
): string {
  let total = 0;
  for (const r of rows) {
    if (r.estimatedValue == null) continue;
    const n = Number(r.estimatedValue.toString());
    if (!Number.isNaN(n)) total += n;
  }
  return total.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export async function loadFinanceStats(
  ownerId: string
): Promise<{ ok: true; stats: FinanceStats } | { ok: false; reason: "unavailable" }> {
  const result = await runWithDb(async () => {
    const [openRows, wonRows, openCount, wonCount, lostCount] = await Promise.all([
      prisma.opportunity.findMany({
        where: { ownerUserId: ownerId, status: "OPEN" },
        select: { estimatedValue: true, priority: true },
      }),
      prisma.opportunity.findMany({
        where: { ownerUserId: ownerId, status: "WON" },
        select: { estimatedValue: true },
      }),
      prisma.opportunity.count({ where: { ownerUserId: ownerId, status: "OPEN" } }),
      prisma.opportunity.count({ where: { ownerUserId: ownerId, status: "WON" } }),
      prisma.opportunity.count({ where: { ownerUserId: ownerId, status: "LOST" } }),
    ]);

    return {
      pipelineOpenEur: sumDecimal(openRows),
      pipelineWeightedEur: weightedPipelineEur(openRows),
      pipelineWonEur: sumDecimal(wonRows),
      openCount,
      wonCount,
      lostCount,
    };
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };
  return { ok: true, stats: result.data };
}

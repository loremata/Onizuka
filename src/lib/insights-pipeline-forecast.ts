import { prisma } from "@/lib/prisma";
import { weightedPipelineEur } from "@/lib/finance-forecast";

export type OwnerPipelineForecast = {
  openCount: number;
  sumEstimatedEur: number;
  weightedPipelineLabel: string;
};

/** Stima commerciale da opportunità aperte (MRR-style: pipeline pesata). */
export async function loadOwnerPipelineForecast(ownerUserId: string): Promise<OwnerPipelineForecast> {
  const rows = await prisma.opportunity.findMany({
    where: { ownerUserId, status: "OPEN" },
    select: { estimatedValue: true, priority: true },
  });
  let sumEstimatedEur = 0;
  for (const r of rows) {
    if (r.estimatedValue == null) continue;
    const n = Number(r.estimatedValue.toString());
    if (!Number.isNaN(n)) sumEstimatedEur += n;
  }
  return {
    openCount: rows.length,
    sumEstimatedEur,
    weightedPipelineLabel: weightedPipelineEur(rows),
  };
}

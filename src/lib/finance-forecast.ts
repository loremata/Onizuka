import type { OpportunityPriority } from "@prisma/client";

const weightByPriority: Record<OpportunityPriority, number> = {
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.75,
};

export function weightedPipelineEur(
  rows: { estimatedValue: { toString: () => string } | null; priority: OpportunityPriority }[]
): string {
  let total = 0;
  for (const r of rows) {
    if (r.estimatedValue == null) continue;
    const n = Number(r.estimatedValue.toString());
    if (Number.isNaN(n)) continue;
    total += n * (weightByPriority[r.priority] ?? 0.5);
  }
  return total.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

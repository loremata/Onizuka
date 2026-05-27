import { prisma } from "@/lib/prisma";
import { leadStatusLabel } from "@/lib/crm-lead-status";

export type CrmLeadAnalytics = {
  total: number;
  byStatus: { status: string; label: string; count: number }[];
  bySource: { source: string; count: number }[];
  converted: number;
  lost: number;
  conversionRatePercent: number;
};

export async function loadCrmLeadAnalytics(ownerUserId: string): Promise<CrmLeadAnalytics> {
  const leads = await prisma.lead.findMany({
    where: { ownerUserId },
    select: { status: true, source: true, convertedClientId: true },
  });

  const statusMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  let converted = 0;
  let lost = 0;

  for (const l of leads) {
    statusMap.set(l.status, (statusMap.get(l.status) ?? 0) + 1);
    const src = l.source?.trim() || "non_specificato";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    if (l.convertedClientId) converted++;
    if (l.status === "LOST") lost++;
  }

  const total = leads.length;
  const conversionRatePercent = total > 0 ? Math.round((converted / total) * 100) : 0;

  return {
    total,
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      label: leadStatusLabel[status as keyof typeof leadStatusLabel] ?? status,
      count,
    })),
    bySource: Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    converted,
    lost,
    conversionRatePercent,
  };
}

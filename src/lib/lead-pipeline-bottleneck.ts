import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { leadStatusLabel } from "@/lib/crm-lead-status";

export type LeadBottleneckItem = {
  leadId: string;
  title: string;
  businessName: string | null;
  status: LeadStatus;
  statusLabel: string;
  agingDays: number;
  expectedSlaDays: number;
  priorityScore: number;
  reason: string;
};

const SLA_DAYS: Partial<Record<LeadStatus, number>> = {
  NEW: 3,
  COLD: 5,
  QUALIFIED: 4,
  CONTACTED: 7,
};

function expectedSla(status: LeadStatus): number {
  return SLA_DAYS[status] ?? 7;
}

export async function getLeadPipelineBottlenecks(
  ownerUserId: string,
  limit = 15
): Promise<LeadBottleneckItem[]> {
  const leads = await prisma.lead.findMany({
    where: {
      ownerUserId,
      convertedClientId: null,
      status: { notIn: ["CONVERTED", "LOST"] },
    },
    orderBy: { updatedAt: "asc" },
    take: 300,
    select: {
      id: true,
      title: true,
      businessName: true,
      status: true,
      updatedAt: true,
    },
  });

  const now = Date.now();
  const items: LeadBottleneckItem[] = [];

  for (const r of leads) {
    const agingDays = Math.max(0, Math.floor((now - r.updatedAt.getTime()) / (1000 * 60 * 60 * 24)));
    const sla = expectedSla(r.status);
    if (agingDays < sla) continue;
    const agingFactor = Math.min(1, agingDays / Math.max(1, sla * 3));
    const priorityScore = Math.round(agingFactor * 100);

    items.push({
      leadId: r.id,
      title: r.title,
      businessName: r.businessName,
      status: r.status,
      statusLabel: leadStatusLabel[r.status] ?? r.status,
      agingDays,
      expectedSlaDays: sla,
      priorityScore,
      reason: `${leadStatusLabel[r.status] ?? r.status} fermo da ${agingDays}g (SLA ${sla}g)`,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, limit);
}

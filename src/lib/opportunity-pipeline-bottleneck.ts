import type { OpportunityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { opportunityStatusLabel } from "@/lib/crm-opportunity";

export type OpportunityBottleneckItem = {
  opportunityId: string;
  title: string;
  clientName: string;
  status: OpportunityStatus;
  statusLabel: string;
  agingDays: number;
  expectedSlaDays: number;
  priorityScore: number;
  reason: string;
  dueDate: Date | null;
};

const SLA_DAYS: Partial<Record<OpportunityStatus, number>> = {
  OPEN: 5,
  PAUSED: 10,
};

function expectedSla(status: OpportunityStatus): number {
  return SLA_DAYS[status] ?? 7;
}

export async function getOpportunityPipelineBottlenecks(
  ownerUserId: string,
  limit = 15
): Promise<OpportunityBottleneckItem[]> {
  const rows = await prisma.opportunity.findMany({
    where: {
      ownerUserId,
      status: { in: ["OPEN", "PAUSED"] },
    },
    orderBy: { updatedAt: "asc" },
    take: 300,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      dueDate: true,
      client: { select: { companyName: true } },
    },
  });

  const now = Date.now();
  const items: OpportunityBottleneckItem[] = [];

  for (const r of rows) {
    const agingDays = Math.max(0, Math.floor((now - r.updatedAt.getTime()) / (1000 * 60 * 60 * 24)));
    const overdueDue =
      r.dueDate && r.dueDate.getTime() < now
        ? Math.max(1, Math.floor((now - r.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
    const sla = expectedSla(r.status);
    const breach = agingDays >= sla || overdueDue > 0;
    if (!breach) continue;

    const effectiveDays = Math.max(agingDays, overdueDue);
    const agingFactor = Math.min(1, effectiveDays / Math.max(1, sla * 3));
    const priorityScore = Math.round(agingFactor * 100);

    const parts: string[] = [];
    if (agingDays >= sla) {
      parts.push(`${opportunityStatusLabel[r.status]} fermo da ${agingDays}g (SLA ${sla}g)`);
    }
    if (overdueDue > 0) {
      parts.push(`scadenza next action superata di ${overdueDue}g`);
    }

    items.push({
      opportunityId: r.id,
      title: r.title,
      clientName: r.client?.companyName ?? "Prospect",
      status: r.status,
      statusLabel: opportunityStatusLabel[r.status] ?? r.status,
      agingDays: effectiveDays,
      expectedSlaDays: sla,
      priorityScore,
      reason: parts.join(" · "),
      dueDate: r.dueDate,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, limit);
}

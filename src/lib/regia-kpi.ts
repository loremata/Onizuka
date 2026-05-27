import { prisma } from "@/lib/prisma";

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeekMondayStart(d: Date): Date {
  const s = startOfWeekMonday(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return e;
}

export type RegiaKpiBundle = {
  weekStart: string;
  weekEnd: string;
  business: {
    leadNuovi: number;
    leadConvertiti: number;
    opportunitaAperte: number;
    preventiviBozza: number;
    valorePipelineEur: string;
  };
  operational: {
    followUpOggi: number;
    leadSenzaAzione: number;
    ticketAperti: number;
  };
};

export async function computeRegiaKpis(ownerUserId: string, now = new Date()): Promise<RegiaKpiBundle> {
  const ws = startOfWeekMonday(now);
  const we = endOfWeekMondayStart(now);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [
    leadNuovi,
    leadConvertiti,
    opportunitaAperte,
    preventiviBozza,
    opps,
    followUpOggi,
    leadSenzaAzione,
    ticketAperti,
  ] = await Promise.all([
    prisma.lead.count({ where: { ownerUserId, createdAt: { gte: ws, lt: we } } }),
    prisma.lead.count({
      where: { ownerUserId, convertedClientId: { not: null }, updatedAt: { gte: ws, lt: we } },
    }),
    prisma.opportunity.count({ where: { ownerUserId, status: "OPEN" } }),
    prisma.opportunityQuote.count({
      where: { opportunity: { ownerUserId }, status: "DRAFT" },
    }),
    prisma.opportunity.findMany({
      where: { ownerUserId, status: "OPEN" },
      select: { estimatedValue: true, probability: true },
    }),
    prisma.leadFollowup.count({
      where: {
        lead: { ownerUserId },
        scheduledAt: { lte: todayEnd },
        outcome: "pending",
      },
    }),
    prisma.lead.count({
      where: {
        ownerUserId,
        convertedClientId: null,
        status: { in: ["NEW", "QUALIFIED", "CONTACTED"] },
        followups: { none: { outcome: "pending" } },
      },
    }),
    prisma.clientTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);

  let pipeline = 0;
  for (const o of opps) {
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    const p = o.probability ?? 50;
    pipeline += (v * p) / 100;
  }

  return {
    weekStart: ws.toISOString().slice(0, 10),
    weekEnd: new Date(we.getTime() - 1).toISOString().slice(0, 10),
    business: {
      leadNuovi,
      leadConvertiti,
      opportunitaAperte,
      preventiviBozza,
      valorePipelineEur: pipeline.toLocaleString("it-IT", { maximumFractionDigits: 0 }),
    },
    operational: {
      followUpOggi,
      leadSenzaAzione,
      ticketAperti,
    },
  };
}

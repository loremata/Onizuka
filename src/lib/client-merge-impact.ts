import { prisma } from "@/lib/prisma";

export type ClientMergeImpactRow = { label: string; count: number };

/** Conteggi record collegati a un cliente (per anteprima merge / wizard). */
export async function getClientMergeImpact(clientId: string): Promise<ClientMergeImpactRow[]> {
  const [
    posts,
    webhooks,
    flowTasks,
    memoryItems,
    opportunities,
    assets,
    contacts,
    tickets,
    outreachDrafts,
    outreachSequences,
    commercialServices,
    digitalAudits,
    financeEntries,
    milestones,
    timeEntries,
  ] = await Promise.all([
    prisma.postItem.count({ where: { clientId } }),
    prisma.webhookSubscription.count({ where: { clientId } }),
    prisma.flowTask.count({ where: { relatedClientId: clientId } }),
    prisma.memoryItem.count({ where: { relatedClientId: clientId } }),
    prisma.opportunity.count({ where: { clientId } }),
    prisma.asset.count({ where: { clientId } }),
    prisma.clientContact.count({ where: { clientId } }),
    prisma.clientTicket.count({ where: { clientId } }),
    prisma.outreachDraft.count({ where: { clientId } }),
    prisma.outreachSequence.count({ where: { clientId } }),
    prisma.clientCommercialService.count({ where: { clientId } }),
    prisma.digitalAudit.count({ where: { clientId } }),
    prisma.financeEntry.count({ where: { clientId } }),
    prisma.clientMilestone.count({ where: { clientId } }),
    prisma.timeEntry.count({ where: { clientId } }),
  ]);

  return [
    { label: "Post", count: posts },
    { label: "Webhook", count: webhooks },
    { label: "Task Flow", count: flowTasks },
    { label: "Memorie", count: memoryItems },
    { label: "Opportunità", count: opportunities },
    { label: "Asset", count: assets },
    { label: "Contatti", count: contacts },
    { label: "Ticket", count: tickets },
    { label: "Reach bozze", count: outreachDrafts },
    { label: "Reach sequenze", count: outreachSequences },
    { label: "Servizi commerciali", count: commercialServices },
    { label: "Audit digitali", count: digitalAudits },
    { label: "Finance", count: financeEntries },
    { label: "Milestone", count: milestones },
    { label: "Time entry", count: timeEntries },
  ];
}

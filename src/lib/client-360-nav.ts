import { prisma } from "@/lib/prisma";

export type Client360NavItem = {
  href: string;
  label: string;
  count?: number;
};

/** Collegamenti rapidi dalla scheda cliente verso moduli filtrati per `clientId`. */
export async function loadClient360Nav(
  clientId: string,
  ownerUserId: string
): Promise<Client360NavItem[]> {
  const q = encodeURIComponent(clientId);
  const [
    opportunities,
    flowOpen,
    outreachPending,
    audits,
    quotesDraft,
    ticketsOpen,
    postsPending,
    financeOpen,
    memories,
    lead,
  ] = await Promise.all([
    prisma.opportunity.count({ where: { clientId, ownerUserId } }),
    prisma.flowTask.count({
      where: { relatedClientId: clientId, ownerUserId, status: { not: "DONE" } },
    }),
    prisma.outreachDraft.count({
      where: { clientId, ownerUserId, status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
    }),
    prisma.digitalAudit.count({ where: { clientId, ownerUserId } }),
    prisma.opportunityQuote.count({
      where: { ownerUserId, opportunity: { clientId }, status: "DRAFT" },
    }),
    prisma.clientTicket.count({ where: { clientId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.postItem.count({ where: { clientId, status: "PENDING" } }),
    prisma.financeEntry.count({
      where: { clientId, ownerUserId, status: { in: ["PLANNED", "EXPECTED", "OVERDUE"] } },
    }),
    prisma.memoryItem.count({ where: { relatedClientId: clientId, ownerUserId } }),
    prisma.lead.findFirst({
      where: { convertedClientId: clientId },
      select: { id: true },
    }),
  ]);

  const items: Client360NavItem[] = [
    { href: `/admin/clients/${clientId}/edit`, label: "Modifica anagrafica" },
    { href: `/admin/crm/opportunities?clientId=${q}`, label: "Opportunità", count: opportunities },
    { href: `/admin/crm/pipeline?clientId=${q}`, label: "Pipeline" },
    { href: `/admin/flow?clientId=${q}`, label: "Flow", count: flowOpen },
    { href: `/admin/reach?clientId=${q}`, label: "Reach", count: outreachPending || undefined },
    { href: `/admin/audit/digital`, label: "Audit digitale", count: audits || undefined },
    { href: `/admin/finance?clientId=${q}`, label: "Finance", count: financeOpen || undefined },
    { href: `/admin/memory?clientId=${q}`, label: "Memoria", count: memories || undefined },
    { href: `/admin/posts?clientId=${q}`, label: "Contenuti", count: postsPending || undefined },
    { href: `/admin/client-portal/tickets?clientId=${q}`, label: "Ticket", count: ticketsOpen || undefined },
    { href: `/admin/documents`, label: "Documenti hub" },
    { href: `/admin/clients/${clientId}/contacts`, label: "Referenti" },
  ];

  if (lead) {
    items.splice(2, 0, {
      href: `/admin/crm/leads/${lead.id}/edit`,
      label: "Lead origine",
    });
  }

  if (quotesDraft > 0) {
    items.push({
      href: `/admin/approvals`,
      label: "Preventivi in coda",
      count: quotesDraft,
    });
  }

  return items;
}

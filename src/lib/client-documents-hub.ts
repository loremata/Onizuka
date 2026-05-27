import { prisma } from "@/lib/prisma";

export type ClientDocumentRow = {
  id: string;
  kind: "audit_pdf" | "drive" | "quote" | "payout" | "ticket_attachment";
  title: string;
  clientName: string;
  clientId: string | null;
  url: string | null;
  createdAt: Date;
};

/** Hub documenti: audit, Drive, preventivi, payout segnalatori (aggregato). */
export async function loadClientDocumentsHub(ownerUserId: string, limit = 60): Promise<ClientDocumentRow[]> {
  const rows: ClientDocumentRow[] = [];

  const audits = await prisma.digitalAudit.findMany({
    where: { ownerUserId, clientReportDriveUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { client: { select: { id: true, companyName: true } } },
  });
  for (const a of audits) {
    rows.push({
      id: `audit-${a.id}`,
      kind: "audit_pdf",
      title: `Report audit · ${a.businessName ?? a.client?.companyName ?? "—"}`,
      clientName: a.client?.companyName ?? a.businessName ?? "—",
      clientId: a.clientId,
      url: a.clientReportDriveUrl,
      createdAt: a.createdAt,
    });
  }

  const clientsWithDrive = await prisma.client.findMany({
    where: { driveFolderUrl: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, companyName: true, driveFolderUrl: true, updatedAt: true },
  });
  for (const c of clientsWithDrive) {
    rows.push({
      id: `drive-${c.id}`,
      kind: "drive",
      title: "Cartella Drive cliente",
      clientName: c.companyName,
      clientId: c.id,
      url: c.driveFolderUrl,
      createdAt: c.updatedAt,
    });
  }

  const quotes = await prisma.opportunityQuote.findMany({
    where: { opportunity: { ownerUserId } },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      opportunity: {
        select: {
          id: true,
          title: true,
          client: { select: { id: true, companyName: true } },
        },
      },
    },
  });
  for (const q of quotes) {
    rows.push({
      id: `quote-${q.id}`,
      kind: "quote",
      title: q.title || `Preventivo · ${q.opportunity.title}`,
      clientName: q.opportunity.client?.companyName ?? "—",
      clientId: q.opportunity.client?.id ?? null,
      url: `/admin/crm/opportunities/${q.opportunity.id}/quotes/${q.id}`,
      createdAt: q.updatedAt,
    });
  }

  const payouts = await prisma.referrerPayout.findMany({
    where: { documentUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { referrer: { select: { name: true } } },
  });
  for (const p of payouts) {
    rows.push({
      id: `payout-${p.id}`,
      kind: "payout",
      title: `Liquidazione · ${p.referrer.name}`,
      clientName: p.referrer.name,
      clientId: null,
      url: p.documentUrl,
      createdAt: p.createdAt,
    });
  }

  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

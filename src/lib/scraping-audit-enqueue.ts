// Mette un lead (da scraping) in coda per l'audit automatico.
// Riusa AuditSheetQueueItem marcando la riga con sheetRowKey "scraping:<leadId>",
// così il cron dedicato (con tetto giornaliero) la processa e il cron sheet la ignora.
// Modulo volutamente leggero (solo Prisma): lo importa anche il worker sul PC.
import { prisma } from "@/lib/prisma";

export function scrapingAuditKey(leadId: string): string {
  return `scraping:${leadId}`;
}

export async function enqueueLeadForAudit(lead: {
  id: string;
  ownerUserId: string;
  vatNumber: string | null;
  businessName: string | null;
  website: string | null;
  city: string | null;
  email: string | null;
}): Promise<void> {
  const sheetRowKey = scrapingAuditKey(lead.id);
  await prisma.auditSheetQueueItem.upsert({
    where: { ownerUserId_sheetRowKey: { ownerUserId: lead.ownerUserId, sheetRowKey } },
    create: {
      ownerUserId: lead.ownerUserId,
      vatNumber: lead.vatNumber,
      businessName: lead.businessName,
      website: lead.website,
      city: lead.city,
      contactEmail: lead.email,
      sheetRowKey,
      status: "PENDING",
    },
    update: {}, // già in coda: non ricreare
  });
}

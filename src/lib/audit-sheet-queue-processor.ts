import { prisma } from "@/lib/prisma";
import { runDigitalAuditUnified } from "@/lib/audit-commercial-entry";
import { processNonVatSheetQueueItem } from "@/lib/audit-sheet-domain-row";
import { enrichAuditOutreach } from "@/lib/audit-sheet-queue-processor-enrich";

export { enrichAuditOutreach } from "@/lib/audit-sheet-queue-processor-enrich";

export async function processAuditSheetQueueBatch(limit = 5): Promise<{
  processed: number;
  done: number;
  failed: number;
  skipped: number;
}> {
  const items = await prisma.auditSheetQueueItem.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let done = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items) {
    await prisma.auditSheetQueueItem.update({
      where: { id: item.id },
      data: { status: "PROCESSING" },
    });

    try {
      if (!item.vatNumber?.trim()) {
        const nonVat = await processNonVatSheetQueueItem(item);
        await prisma.auditSheetQueueItem.update({
          where: { id: item.id },
          data: {
            status: nonVat.status === "DONE" ? "DONE" : nonVat.status === "SKIPPED" ? "SKIPPED" : "FAILED",
            clientId: nonVat.clientId ?? null,
            digitalAuditId: nonVat.auditId ?? null,
            processedAt: new Date(),
            errorDetail: nonVat.errorDetail?.slice(0, 2000) ?? null,
          },
        });
        if (nonVat.status === "DONE") done++;
        else if (nonVat.status === "SKIPPED") skipped++;
        else failed++;
        continue;
      }

      const result = await runDigitalAuditUnified({
        ownerUserId: item.ownerUserId,
        vatNumber: item.vatNumber,
        website: item.website,
        businessName: item.businessName,
        city: item.city,
        acquisitionSource: "sheet_queue",
        createOutreachDraft: true,
        enrichClient: {
          businessName: item.businessName,
          contactEmail: item.contactEmail,
          website: item.website,
          city: item.city,
        },
      });

      await enrichAuditOutreach(result.auditId);

      await prisma.auditSheetQueueItem.update({
        where: { id: item.id },
        data: {
          status: "DONE",
          clientId: result.clientId,
          digitalAuditId: result.auditId,
          processedAt: new Date(),
          errorDetail: null,
        },
      });
      done++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore sconosciuto";
      await prisma.auditSheetQueueItem.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          errorDetail: msg.slice(0, 2000),
          processedAt: new Date(),
        },
      });
      failed++;
    }
  }

  return { processed: items.length, done, failed, skipped };
}

import { prisma } from "@/lib/prisma";
import { runDigitalAuditUnified } from "@/lib/audit-commercial-entry";
import { processNonVatSheetQueueItem } from "@/lib/audit-sheet-domain-row";
import { enrichAuditOutreach } from "@/lib/audit-sheet-queue-processor-enrich";
import { writeAuditResultToSheet } from "@/lib/audit-sheet-writeback";

export { enrichAuditOutreach } from "@/lib/audit-sheet-queue-processor-enrich";

/** Oltre questa soglia un item "PROCESSING" è considerato orfano (run precedente interrotto). */
const STALE_PROCESSING_MS = 10 * 60_000;

export async function processAuditSheetQueueBatch(limit = 5): Promise<{
  processed: number;
  done: number;
  failed: number;
  skipped: number;
  reclaimed: number;
}> {
  // Recupero righe rimaste bloccate in PROCESSING da un run precedente andato in
  // timeout/crash: senza questo restano per sempre fuori dalla coda (il processore
  // guarda solo i PENDING) e l'azienda non viene mai auditata. processedAt fa da
  // timestamp di "claim": lo impostiamo quando segniamo PROCESSING (sotto).
  const reclaim = await prisma.auditSheetQueueItem.updateMany({
    where: {
      status: "PROCESSING",
      OR: [{ processedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } }, { processedAt: null }],
    },
    data: { status: "PENDING" },
  });
  const reclaimed = reclaim.count;

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
      // processedAt qui = istante di "claim": serve al recupero degli orfani sopra.
      data: { status: "PROCESSING", processedAt: new Date() },
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
        if (nonVat.status === "DONE") {
          done++;
          if (nonVat.auditId) {
            await writeAuditResultToSheet(item.sheetRowKey, nonVat.auditId).catch(() => undefined);
          }
        } else if (nonVat.status === "SKIPPED") skipped++;
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
      await writeAuditResultToSheet(item.sheetRowKey, result.auditId).catch(() => undefined);
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

  return { processed: items.length, done, failed, skipped, reclaimed };
}

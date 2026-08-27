// Processore della coda audit da SCRAPING, con tetto giornaliero.
// Gira solo lato server (cron su Vercel). Processa gli AuditSheetQueueItem marcati
// "scraping:<leadId>" a piccoli lotti, fino a un massimo di N audit al giorno.
import { prisma } from "@/lib/prisma";
import { runDigitalAuditUnified } from "@/lib/audit-commercial-entry";
import { processNonVatSheetQueueItem } from "@/lib/audit-sheet-domain-row";
import { enrichAuditOutreach } from "@/lib/audit-sheet-queue-processor-enrich";

export const SCRAPING_AUDIT_DAILY_CAP = Number(process.env.SCRAPING_AUDIT_DAILY_CAP) || 50;
const STALE_PROCESSING_MS = 10 * 60_000;
const SCRAPING_PREFIX = "scraping:";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function processScrapingAuditBatch(batchLimit = 4): Promise<{
  processed: number;
  done: number;
  failed: number;
  skipped: number;
  capReached: boolean;
  doneToday: number;
}> {
  // Recupero orfani (PROCESSING bloccati da un run precedente) tra gli item scraping.
  await prisma.auditSheetQueueItem.updateMany({
    where: {
      status: "PROCESSING",
      sheetRowKey: { startsWith: SCRAPING_PREFIX },
      OR: [{ processedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } }, { processedAt: null }],
    },
    data: { status: "PENDING" },
  });

  // Tetto giornaliero: quanti audit scraping sono già stati completati oggi.
  const doneToday = await prisma.auditSheetQueueItem.count({
    where: { sheetRowKey: { startsWith: SCRAPING_PREFIX }, status: "DONE", processedAt: { gte: startOfToday() } },
  });
  const remaining = Math.max(0, SCRAPING_AUDIT_DAILY_CAP - doneToday);
  if (remaining === 0) {
    return { processed: 0, done: 0, failed: 0, skipped: 0, capReached: true, doneToday };
  }

  // Prioritizzazione per CONTATTABILITÀ, fatta dal DATABASE.
  //
  // Prima si prendevano i 500 PENDING più vecchi e si ordinavano in memoria: con
  // una coda piccola bastava, ma dopo Rosignano e Cecina i PENDING sono quasi
  // 4.000 e la finestra dei 500 si riempiva di micro-lead solo-registro (niente
  // sito, niente telefono, niente email). Risultato: il tetto giornaliero bruciato
  // per settimane su audit ciechi, mentre i ~750 con un canale vero aspettavano.
  //
  // L'ordinamento è quindi sull'intera coda: sito(2) + telefono(1) + email(1),
  // poi FIFO a parità. Il telefono sta sul Lead (sheetRowKey = "scraping:<leadId>"),
  // e si aggancia con una join invece che con una seconda query.
  const take = Math.min(batchLimit, remaining);
  const scelti = await prisma.$queryRaw<{ id: string }[]>`
    SELECT q."id"
    FROM "AuditSheetQueueItem" q
    LEFT JOIN "Lead" l ON l."id" = substring(q."sheetRowKey" from ${SCRAPING_PREFIX.length + 1}::int)
    WHERE q."status" = 'PENDING' AND q."sheetRowKey" LIKE ${`${SCRAPING_PREFIX}%`}
    ORDER BY
      (
        (CASE WHEN COALESCE(q."website", '') <> '' THEN 2 ELSE 0 END) +
        (CASE WHEN COALESCE(q."contactEmail", '') <> ''
              AND q."contactEmail" NOT ILIKE '%@onizuka.local' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(l."phone", '') <> '' THEN 1 ELSE 0 END)
      ) DESC,
      q."createdAt" ASC
    LIMIT ${take}
  `;
  const items = scelti.length
    ? await prisma.auditSheetQueueItem.findMany({ where: { id: { in: scelti.map((r) => r.id) } } })
    : [];

  let done = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items) {
    await prisma.auditSheetQueueItem.update({
      where: { id: item.id },
      data: { status: "PROCESSING", processedAt: new Date() },
    });

    try {
      // Aziende senza P.IVA (solo-Google): percorso non-VAT (match per dominio/nome).
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
        data: { status: "FAILED", errorDetail: msg.slice(0, 2000), processedAt: new Date() },
      });
      failed++;
    }
  }

  return { processed: items.length, done, failed, skipped, capReached: false, doneToday: doneToday + done };
}

-- ST-01 / SQ-01: sheet queue righe dominio-only (non-destructive, dev/local)

ALTER TABLE "AuditSheetQueueItem" ALTER COLUMN "vatNumber" DROP NOT NULL;

ALTER TABLE "AuditSheetQueueItem" ADD COLUMN IF NOT EXISTS "city" TEXT;

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN "sdiExportedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OutreachDraft" ADD COLUMN "subjectAlt" TEXT;

-- CreateEnum
CREATE TYPE "AuditSheetQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "DigitalAudit" ADD COLUMN "publicReportToken" TEXT,
ADD COLUMN "publicReportExpiresAt" TIMESTAMP(3),
ADD COLUMN "outreachLinkedInBody" TEXT,
ADD COLUMN "outreachCallScript" TEXT;

-- AlterTable
ALTER TABLE "PostItem" ADD COLUMN "publishUrl" TEXT,
ADD COLUMN "impressions" INTEGER,
ADD COLUMN "reach" INTEGER,
ADD COLUMN "engagement" INTEGER;

-- CreateTable
CREATE TABLE "AuditSheetQueueItem" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vatNumber" TEXT NOT NULL,
    "businessName" TEXT,
    "contactEmail" TEXT,
    "website" TEXT,
    "sheetRowKey" TEXT NOT NULL,
    "status" "AuditSheetQueueStatus" NOT NULL DEFAULT 'PENDING',
    "errorDetail" TEXT,
    "digitalAuditId" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AuditSheetQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DigitalAudit_publicReportToken_key" ON "DigitalAudit"("publicReportToken");

-- CreateIndex
CREATE UNIQUE INDEX "AuditSheetQueueItem_ownerUserId_sheetRowKey_key" ON "AuditSheetQueueItem"("ownerUserId", "sheetRowKey");

-- CreateIndex
CREATE INDEX "AuditSheetQueueItem_ownerUserId_status_idx" ON "AuditSheetQueueItem"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "AuditSheetQueueItem_status_createdAt_idx" ON "AuditSheetQueueItem"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditSheetQueueItem" ADD CONSTRAINT "AuditSheetQueueItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

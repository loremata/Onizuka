-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN "secondApprovedAt" TIMESTAMP(3),
ADD COLUMN "secondApprovedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_secondApprovedByUserId_fkey" FOREIGN KEY ("secondApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "TimeEntry_secondApprovedAt_idx" ON "TimeEntry"("secondApprovedAt");

-- Backfill: voci già approvate restano valide come doppia approvazione (stesso revisore)
UPDATE "TimeEntry"
SET "secondApprovedAt" = "approvedAt",
    "secondApprovedByUserId" = "approvedByUserId"
WHERE "approvedAt" IS NOT NULL;

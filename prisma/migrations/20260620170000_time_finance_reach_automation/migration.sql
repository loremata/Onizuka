-- AlterEnum
ALTER TYPE "AutomationRuleTrigger" ADD VALUE 'REACH_DRAFT_SENT';

-- AlterTable TimeEntry
ALTER TABLE "TimeEntry" ADD COLUMN "billable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TimeEntry" ADD COLUMN "hourlyRateEur" DECIMAL(10,2);
ALTER TABLE "TimeEntry" ADD COLUMN "projectCode" TEXT;
ALTER TABLE "TimeEntry" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "TimeEntry" ADD COLUMN "approvedByUserId" TEXT;

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TimeEntry_approvedAt_idx" ON "TimeEntry"("approvedAt");

-- AlterTable FinanceEntry (MRR mensile strutturato)
ALTER TABLE "FinanceEntry" ADD COLUMN "recurringMonthly" BOOLEAN NOT NULL DEFAULT false;

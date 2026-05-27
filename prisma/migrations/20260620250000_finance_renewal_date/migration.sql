-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN "renewalDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "FinanceEntry_renewalDate_idx" ON "FinanceEntry"("renewalDate");

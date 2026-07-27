-- AlterTable
ALTER TABLE "IncentiveScoreKpi" ADD COLUMN     "matchSubtype" TEXT,
ADD COLUMN     "sourceLineKey" TEXT;

-- CreateTable
CREATE TABLE "IncentiveOfficialProgress" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "brand" "StoreBrand" NOT NULL DEFAULT 'TIM',
    "month" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "lineKey" TEXT NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "domiciledQty" INTEGER,
    "breakdown" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentiveOfficialProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncentiveOfficialProgress_ownerUserId_month_idx" ON "IncentiveOfficialProgress"("ownerUserId", "month");

-- CreateIndex
CREATE INDEX "IncentiveOfficialProgress_brand_month_asOfDate_idx" ON "IncentiveOfficialProgress"("brand", "month", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveOfficialProgress_ownerUserId_brand_month_asOfDate__key" ON "IncentiveOfficialProgress"("ownerUserId", "brand", "month", "asOfDate", "lineKey");

-- Sicurezza: RLS sulla nuova tabella (coerente con 20260724130000_enable_rls_all_tables).
ALTER TABLE "IncentiveOfficialProgress" ENABLE ROW LEVEL SECURITY;

-- CreateEnum
CREATE TYPE "StoreBrand" AS ENUM ('TIM', 'KENA', 'FASTWEB', 'ENEL', 'ENI', 'ILIAD');

-- CreateEnum
CREATE TYPE "IncentivePlanStatus" AS ENUM ('PROVISIONAL', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IncentiveUnit" AS ENUM ('MULTIPLIER_ON_FEE', 'EUR_PER_PIECE');

-- CreateEnum
CREATE TYPE "IncentiveLineStatus" AS ENUM ('ATTIVA', 'IN_ABILITAZIONE', 'NON_ABILITATA', 'BLOCCATA');

-- CreateEnum
CREATE TYPE "IncentivePrizeKey" AS ENUM ('TOP_CLUB', 'CUSTOMER_BASE');

-- CreateEnum
CREATE TYPE "IncentiveKpiSource" AS ENUM ('DERIVED', 'MANUAL');

-- CreateEnum
CREATE TYPE "StoreProvenance" AS ENUM ('ILIAD', 'COOP', 'POSTE', 'FASTWEB', 'KENA', 'ALTRO');

-- CreateEnum
CREATE TYPE "StoreFeeSource" AS ENUM ('LISTINO', 'MANUALE');

-- CreateTable
CREATE TABLE "IncentivePlan" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "brand" "StoreBrand" NOT NULL,
    "month" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceDoc" TEXT,
    "status" "IncentivePlanStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "engineVersion" TEXT NOT NULL,
    "copiedFromPlanId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentivePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveLine" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "unit" "IncentiveUnit" NOT NULL,
    "hasTiers" BOOLEAN NOT NULL DEFAULT false,
    "target" INTEGER,
    "revenueEur" DECIMAL(12,2),
    "status" "IncentiveLineStatus" NOT NULL DEFAULT 'ATTIVA',
    "statusNote" TEXT,
    "rules" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentiveLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveTier" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "IncentiveTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentivePrize" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" "IncentivePrizeKey" NOT NULL,
    "label" TEXT NOT NULL,
    "minPoints" DECIMAL(12,2) NOT NULL,
    "maxPoints" DECIMAL(12,2) NOT NULL,
    "minPrize" DECIMAL(12,2) NOT NULL,
    "maxPrize" DECIMAL(12,2) NOT NULL,
    "rules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentivePrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveGate" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "lineKey" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,

    CONSTRAINT "IncentiveGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveScoreKpi" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" DECIMAL(12,2) NOT NULL,
    "source" "IncentiveKpiSource" NOT NULL DEFAULT 'DERIVED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IncentiveScoreKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveBonus" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "conditionLineKey" TEXT NOT NULL,
    "conditionMinQty" INTEGER NOT NULL,
    "pct" DECIMAL(6,4) NOT NULL,
    "label" TEXT,

    CONSTRAINT "IncentiveBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveHalving" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "minValue" DECIMAL(12,2) NOT NULL,
    "factor" DECIMAL(6,4) NOT NULL DEFAULT 0.5,
    "label" TEXT,

    CONSTRAINT "IncentiveHalving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveParam" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,

    CONSTRAINT "IncentiveParam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOffer" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "brand" "StoreBrand" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feeEur" DECIMAL(12,2) NOT NULL,
    "lineKey" TEXT,
    "category" TEXT,
    "target" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSale" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "month" TEXT NOT NULL,
    "brand" "StoreBrand" NOT NULL,
    "lineKey" TEXT NOT NULL,
    "offerCode" TEXT,
    "feeEur" DECIMAL(12,2),
    "feeSource" "StoreFeeSource" NOT NULL DEFAULT 'LISTINO',
    "domiciled" BOOLEAN NOT NULL DEFAULT false,
    "provenance" "StoreProvenance",
    "subtype" TEXT,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreMonthlyInput" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreMonthlyInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncentivePlan_ownerUserId_month_idx" ON "IncentivePlan"("ownerUserId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "IncentivePlan_ownerUserId_brand_month_key" ON "IncentivePlan"("ownerUserId", "brand", "month");

-- CreateIndex
CREATE INDEX "IncentiveLine_planId_idx" ON "IncentiveLine"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveLine_planId_key_key" ON "IncentiveLine"("planId", "key");

-- CreateIndex
CREATE INDEX "IncentiveTier_lineId_idx" ON "IncentiveTier"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveTier_lineId_minQty_key" ON "IncentiveTier"("lineId", "minQty");

-- CreateIndex
CREATE INDEX "IncentivePrize_planId_idx" ON "IncentivePrize"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentivePrize_planId_key_key" ON "IncentivePrize"("planId", "key");

-- CreateIndex
CREATE INDEX "IncentiveGate_prizeId_idx" ON "IncentiveGate"("prizeId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveGate_prizeId_lineKey_key" ON "IncentiveGate"("prizeId", "lineKey");

-- CreateIndex
CREATE INDEX "IncentiveScoreKpi_prizeId_idx" ON "IncentiveScoreKpi"("prizeId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveScoreKpi_prizeId_key_key" ON "IncentiveScoreKpi"("prizeId", "key");

-- CreateIndex
CREATE INDEX "IncentiveBonus_prizeId_idx" ON "IncentiveBonus"("prizeId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveBonus_prizeId_conditionLineKey_key" ON "IncentiveBonus"("prizeId", "conditionLineKey");

-- CreateIndex
CREATE INDEX "IncentiveHalving_prizeId_idx" ON "IncentiveHalving"("prizeId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveHalving_prizeId_inputKey_key" ON "IncentiveHalving"("prizeId", "inputKey");

-- CreateIndex
CREATE INDEX "IncentiveParam_planId_idx" ON "IncentiveParam"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveParam_planId_key_key" ON "IncentiveParam"("planId", "key");

-- CreateIndex
CREATE INDEX "StoreOffer_ownerUserId_brand_idx" ON "StoreOffer"("ownerUserId", "brand");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOffer_ownerUserId_brand_code_key" ON "StoreOffer"("ownerUserId", "brand", "code");

-- CreateIndex
CREATE INDEX "StoreSale_ownerUserId_month_idx" ON "StoreSale"("ownerUserId", "month");

-- CreateIndex
CREATE INDEX "StoreSale_ownerUserId_month_brand_idx" ON "StoreSale"("ownerUserId", "month", "brand");

-- CreateIndex
CREATE INDEX "StoreSale_clientId_idx" ON "StoreSale"("clientId");

-- CreateIndex
CREATE INDEX "StoreMonthlyInput_ownerUserId_month_idx" ON "StoreMonthlyInput"("ownerUserId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "StoreMonthlyInput_ownerUserId_month_key_key" ON "StoreMonthlyInput"("ownerUserId", "month", "key");

-- AddForeignKey
ALTER TABLE "IncentivePlan" ADD CONSTRAINT "IncentivePlan_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentivePlan" ADD CONSTRAINT "IncentivePlan_copiedFromPlanId_fkey" FOREIGN KEY ("copiedFromPlanId") REFERENCES "IncentivePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveLine" ADD CONSTRAINT "IncentiveLine_planId_fkey" FOREIGN KEY ("planId") REFERENCES "IncentivePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveTier" ADD CONSTRAINT "IncentiveTier_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "IncentiveLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentivePrize" ADD CONSTRAINT "IncentivePrize_planId_fkey" FOREIGN KEY ("planId") REFERENCES "IncentivePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveGate" ADD CONSTRAINT "IncentiveGate_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "IncentivePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveScoreKpi" ADD CONSTRAINT "IncentiveScoreKpi_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "IncentivePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveBonus" ADD CONSTRAINT "IncentiveBonus_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "IncentivePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveHalving" ADD CONSTRAINT "IncentiveHalving_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "IncentivePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveParam" ADD CONSTRAINT "IncentiveParam_planId_fkey" FOREIGN KEY ("planId") REFERENCES "IncentivePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOffer" ADD CONSTRAINT "StoreOffer_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSale" ADD CONSTRAINT "StoreSale_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSale" ADD CONSTRAINT "StoreSale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMonthlyInput" ADD CONSTRAINT "StoreMonthlyInput_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

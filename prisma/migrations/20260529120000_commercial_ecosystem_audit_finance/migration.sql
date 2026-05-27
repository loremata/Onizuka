-- CreateEnum
CREATE TYPE "CommercialServiceCategory" AS ENUM ('TELECOM', 'ENERGY', 'WEB', 'MARKETING', 'BRANDING', 'AUTOMATION', 'CONSULTING', 'OTHER');

-- CreateEnum
CREATE TYPE "DigitalAuditStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DigitalAuditSectionKey" AS ENUM ('WEBSITE', 'SEO', 'LOCAL', 'REVIEWS', 'SOCIAL', 'ADV', 'UX', 'CONVERSION', 'TRACKING', 'BRAND');

-- CreateEnum
CREATE TYPE "FinanceEntryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceEntryStatus" AS ENUM ('PLANNED', 'EXPECTED', 'RECEIVED', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE "EcosystemBrand" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "mission" TEXT,
    "positioning" TEXT,
    "toneOfVoice" TEXT,
    "commercialLeversJson" TEXT,
    "idealUseCasesJson" TEXT,
    "differencesFromOthersJson" TEXT,
    "ecosystemRole" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcosystemBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialService" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CommercialServiceCategory" NOT NULL DEFAULT 'OTHER',
    "ecosystemBrandId" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCommercialService" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "commercialServiceId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "since" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCommercialService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAudit" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "clientId" TEXT,
    "vatNumber" TEXT,
    "businessName" TEXT,
    "website" TEXT,
    "status" "DigitalAuditStatus" NOT NULL DEFAULT 'PENDING',
    "overallScore" INTEGER,
    "priorityProblem" TEXT,
    "recommendedBrandId" TEXT,
    "recommendedServiceId" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAuditSection" (
    "id" TEXT NOT NULL,
    "digitalAuditId" TEXT NOT NULL,
    "sectionKey" "DigitalAuditSectionKey" NOT NULL,
    "score" INTEGER NOT NULL,
    "positives" TEXT,
    "issues" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalAuditSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "clientId" TEXT,
    "type" "FinanceEntryType" NOT NULL,
    "status" "FinanceEntryStatus" NOT NULL DEFAULT 'PLANNED',
    "label" TEXT NOT NULL,
    "amountEur" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OutreachDraft" ADD COLUMN "digitalAuditId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EcosystemBrand_slug_key" ON "EcosystemBrand"("slug");

-- CreateIndex
CREATE INDEX "EcosystemBrand_sortOrder_idx" ON "EcosystemBrand"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialService_slug_key" ON "CommercialService"("slug");

-- CreateIndex
CREATE INDEX "CommercialService_category_idx" ON "CommercialService"("category");

-- CreateIndex
CREATE INDEX "CommercialService_ecosystemBrandId_idx" ON "CommercialService"("ecosystemBrandId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCommercialService_clientId_commercialServiceId_key" ON "ClientCommercialService"("clientId", "commercialServiceId");

-- CreateIndex
CREATE INDEX "ClientCommercialService_clientId_idx" ON "ClientCommercialService"("clientId");

-- CreateIndex
CREATE INDEX "DigitalAudit_ownerUserId_idx" ON "DigitalAudit"("ownerUserId");

-- CreateIndex
CREATE INDEX "DigitalAudit_clientId_idx" ON "DigitalAudit"("clientId");

-- CreateIndex
CREATE INDEX "DigitalAudit_status_idx" ON "DigitalAudit"("status");

-- CreateIndex
CREATE INDEX "DigitalAudit_createdAt_idx" ON "DigitalAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalAuditSection_digitalAuditId_sectionKey_key" ON "DigitalAuditSection"("digitalAuditId", "sectionKey");

-- CreateIndex
CREATE INDEX "DigitalAuditSection_digitalAuditId_idx" ON "DigitalAuditSection"("digitalAuditId");

-- CreateIndex
CREATE INDEX "FinanceEntry_ownerUserId_idx" ON "FinanceEntry"("ownerUserId");

-- CreateIndex
CREATE INDEX "FinanceEntry_type_idx" ON "FinanceEntry"("type");

-- CreateIndex
CREATE INDEX "FinanceEntry_status_idx" ON "FinanceEntry"("status");

-- CreateIndex
CREATE INDEX "FinanceEntry_dueDate_idx" ON "FinanceEntry"("dueDate");

-- CreateIndex
CREATE INDEX "OutreachDraft_digitalAuditId_idx" ON "OutreachDraft"("digitalAuditId");

-- AddForeignKey
ALTER TABLE "CommercialService" ADD CONSTRAINT "CommercialService_ecosystemBrandId_fkey" FOREIGN KEY ("ecosystemBrandId") REFERENCES "EcosystemBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommercialService" ADD CONSTRAINT "ClientCommercialService_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommercialService" ADD CONSTRAINT "ClientCommercialService_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalAudit" ADD CONSTRAINT "DigitalAudit_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalAudit" ADD CONSTRAINT "DigitalAudit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalAudit" ADD CONSTRAINT "DigitalAudit_recommendedBrandId_fkey" FOREIGN KEY ("recommendedBrandId") REFERENCES "EcosystemBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalAudit" ADD CONSTRAINT "DigitalAudit_recommendedServiceId_fkey" FOREIGN KEY ("recommendedServiceId") REFERENCES "CommercialService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalAuditSection" ADD CONSTRAINT "DigitalAuditSection_digitalAuditId_fkey" FOREIGN KEY ("digitalAuditId") REFERENCES "DigitalAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_digitalAuditId_fkey" FOREIGN KEY ("digitalAuditId") REFERENCES "DigitalAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

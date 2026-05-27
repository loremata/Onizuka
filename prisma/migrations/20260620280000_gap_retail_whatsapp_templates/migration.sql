-- CreateEnum
CREATE TYPE "RetailContractKind" AS ENUM ('MOBILE', 'ENERGY', 'SKY', 'OTHER');
CREATE TYPE "RetailContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ClientRetailContract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" "RetailContractKind" NOT NULL DEFAULT 'OTHER',
    "label" TEXT NOT NULL,
    "monthlyEur" DECIMAL(12,2) NOT NULL,
    "renewalDate" TIMESTAMP(3),
    "status" "RetailContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "financeEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRetailContract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientRetailContract_clientId_idx" ON "ClientRetailContract"("clientId");
CREATE INDEX "ClientRetailContract_ownerUserId_idx" ON "ClientRetailContract"("ownerUserId");
CREATE INDEX "ClientRetailContract_renewalDate_idx" ON "ClientRetailContract"("renewalDate");

ALTER TABLE "ClientRetailContract" ADD CONSTRAINT "ClientRetailContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientRetailContract" ADD CONSTRAINT "ClientRetailContract_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Template regole condivisibili tra utenti admin
CREATE TABLE "AutomationRuleTemplate" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRuleTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRuleTemplate_ownerUserId_idx" ON "AutomationRuleTemplate"("ownerUserId");
CREATE INDEX "AutomationRuleTemplate_shared_idx" ON "AutomationRuleTemplate"("shared");

ALTER TABLE "AutomationRuleTemplate" ADD CONSTRAINT "AutomationRuleTemplate_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DedupeScanRun" ADD COLUMN "alertEmailSentAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "timeApproverClientIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

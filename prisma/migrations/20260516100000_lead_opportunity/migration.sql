-- Onizuka CRM: Lead e Opportunity (MVP)

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'COLD', 'QUALIFIED', 'CONTACTED', 'CONVERTED', 'LOST');

CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'PAUSED');

CREATE TYPE "OpportunityPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contactName" TEXT,
    "businessName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vatNumber" TEXT,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW'::"LeadStatus",
    "notes" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "convertedClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lead_convertedClientId_key" ON "Lead"("convertedClientId");

CREATE INDEX "Lead_ownerUserId_idx" ON "Lead"("ownerUserId");

CREATE INDEX "Lead_status_idx" ON "Lead"("status");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assetId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN'::"OpportunityStatus",
    "priority" "OpportunityPriority" NOT NULL DEFAULT 'MEDIUM'::"OpportunityPriority",
    "estimatedValue" DECIMAL(12,2),
    "probability" INTEGER,
    "nextAction" TEXT,
    "dueDate" TIMESTAMP(3),
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Opportunity_ownerUserId_idx" ON "Opportunity"("ownerUserId");

CREATE INDEX "Opportunity_clientId_idx" ON "Opportunity"("clientId");

CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

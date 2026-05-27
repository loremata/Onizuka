-- Reach open tracking
ALTER TABLE "OutreachDraft" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
ALTER TABLE "OutreachDraft" ADD COLUMN IF NOT EXISTS "openCount" INTEGER NOT NULL DEFAULT 0;

-- Digital audit GBP snapshot
ALTER TABLE "DigitalAudit" ADD COLUMN IF NOT EXISTS "gbpRating" DOUBLE PRECISION;
ALTER TABLE "DigitalAudit" ADD COLUMN IF NOT EXISTS "gbpReviewCount" INTEGER;
ALTER TABLE "DigitalAudit" ADD COLUMN IF NOT EXISTS "gbpPlaceName" TEXT;

-- Finance invoice numbers
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceEntry_ownerUserId_invoiceNumber_key"
  ON "FinanceEntry"("ownerUserId", "invoiceNumber")
  WHERE "invoiceNumber" IS NOT NULL;

-- Client project milestones
CREATE TABLE IF NOT EXISTS "ClientMilestone" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "targetDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientMilestone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClientMilestone_clientId_idx" ON "ClientMilestone"("clientId");
CREATE INDEX IF NOT EXISTS "ClientMilestone_ownerUserId_idx" ON "ClientMilestone"("ownerUserId");
DO $$ BEGIN
  ALTER TABLE "ClientMilestone" ADD CONSTRAINT "ClientMilestone_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClientMilestone" ADD CONSTRAINT "ClientMilestone_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

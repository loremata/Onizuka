-- AP-02 / CM-02: Opportunity.leadId + prospect signals (non-destructive, dev/local)

ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "leadId" TEXT;

ALTER TABLE "Opportunity" ALTER COLUMN "clientId" DROP NOT NULL;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "googlePlaceId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "city" TEXT;

CREATE INDEX IF NOT EXISTS "Opportunity_leadId_idx" ON "Opportunity"("leadId");
CREATE INDEX IF NOT EXISTS "Lead_googlePlaceId_idx" ON "Lead"("googlePlaceId");
CREATE INDEX IF NOT EXISTS "Lead_ownerUserId_googlePlaceId_idx" ON "Lead"("ownerUserId", "googlePlaceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Opportunity_leadId_fkey'
  ) THEN
    ALTER TABLE "Opportunity"
      ADD CONSTRAINT "Opportunity_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

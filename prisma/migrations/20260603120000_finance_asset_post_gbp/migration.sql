-- Asset profile URL (GBP/maps)
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "profileUrl" TEXT;

-- Finance entry linked to marketing asset
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "assetId" TEXT;
CREATE INDEX IF NOT EXISTS "FinanceEntry_assetId_idx" ON "FinanceEntry"("assetId");
DO $$ BEGIN
  ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Client creative uploads hidden until admin releases for review
ALTER TABLE "PostItem" ADD COLUMN IF NOT EXISTS "awaitingClientReview" BOOLEAN NOT NULL DEFAULT true;

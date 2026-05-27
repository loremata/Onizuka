-- Sostituisce Asset del vecchio MVP (brand book) con catalogo asset per cliente.

DROP TABLE IF EXISTS "Asset" CASCADE;

CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "platform" "Platform",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Asset_clientId_slug_key" ON "Asset"("clientId", "slug");
CREATE INDEX "Asset_clientId_idx" ON "Asset"("clientId");

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Opportunity.assetId FK (se colonna già presente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Opportunity_assetId_fkey'
  ) THEN
    ALTER TABLE "Opportunity"
      ADD CONSTRAINT "Opportunity_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MemoryItem_relatedAssetId_fkey'
  ) THEN
    ALTER TABLE "MemoryItem"
      ADD CONSTRAINT "MemoryItem_relatedAssetId_fkey"
      FOREIGN KEY ("relatedAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

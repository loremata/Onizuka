-- FK Asset su Opportunity e MemoryItem (dopo creazione tabelle CRM / Memory).

CREATE INDEX "Opportunity_assetId_idx" ON "Opportunity"("assetId");

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MemoryItem_relatedAssetId_idx" ON "MemoryItem"("relatedAssetId");

ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_relatedAssetId_fkey" FOREIGN KEY ("relatedAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

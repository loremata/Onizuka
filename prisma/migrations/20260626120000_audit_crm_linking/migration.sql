-- CM-01 / AP-01: collegamento audit ↔ lead ↔ opportunity

ALTER TABLE "DigitalAudit" ADD COLUMN IF NOT EXISTS "leadId" TEXT;

ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "digitalAuditId" TEXT;

CREATE INDEX IF NOT EXISTS "DigitalAudit_leadId_idx" ON "DigitalAudit"("leadId");
CREATE INDEX IF NOT EXISTS "Opportunity_digitalAuditId_idx" ON "Opportunity"("digitalAuditId");
CREATE INDEX IF NOT EXISTS "Opportunity_source_idx" ON "Opportunity"("source");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DigitalAudit_leadId_fkey'
  ) THEN
    ALTER TABLE "DigitalAudit"
      ADD CONSTRAINT "DigitalAudit_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

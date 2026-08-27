-- Storico delle transizioni di stadio del lead: il funnel aveva solo il presente,
-- quindi nessuno poteva dire da quanto un lead è fermo né chi l'ha mosso.
-- Idempotente: riapplicabile senza danni.
CREATE TABLE IF NOT EXISTS "LeadStageEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStage" "CommercialProspectStage",
    "toStage" "CommercialProspectStage" NOT NULL,
    "source" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadStageEvent_leadId_at_idx" ON "LeadStageEvent"("leadId", "at");
CREATE INDEX IF NOT EXISTS "LeadStageEvent_toStage_at_idx" ON "LeadStageEvent"("toStage", "at");

DO $$
BEGIN
  ALTER TABLE "LeadStageEvent"
    ADD CONSTRAINT "LeadStageEvent_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

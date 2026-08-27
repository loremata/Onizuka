-- Attribuzione mail → opportunità: senza, il ricavo si fermava a "arrivato
-- dall'outreach" e non si poteva risalire alla mail (quindi alla variante e al
-- segmento) che l'ha prodotto. Idempotente.
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "outreachDraftId" TEXT;

CREATE INDEX IF NOT EXISTS "Opportunity_outreachDraftId_idx" ON "Opportunity"("outreachDraftId");

DO $$
BEGIN
  ALTER TABLE "Opportunity"
    ADD CONSTRAINT "Opportunity_outreachDraftId_fkey"
    FOREIGN KEY ("outreachDraftId") REFERENCES "OutreachDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

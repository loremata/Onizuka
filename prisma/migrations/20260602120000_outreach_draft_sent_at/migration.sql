ALTER TABLE "OutreachDraft" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "OutreachDraft_sentAt_idx" ON "OutreachDraft"("sentAt");

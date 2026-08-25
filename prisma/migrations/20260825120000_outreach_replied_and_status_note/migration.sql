-- Esito e trasparenza sull'outreach:
--  - repliedAt: quando il destinatario ha risposto via email (watcher IMAP).
--  - statusNote: perche' una bozza e' stata scartata/bloccata — prima gli scarti
--    avvenivano in silenzio (1.210 CANCELLED senza motivo registrato).
-- Idempotente: IF NOT EXISTS, riapplicabile senza danni.
ALTER TABLE "OutreachDraft" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);
ALTER TABLE "OutreachDraft" ADD COLUMN IF NOT EXISTS "statusNote" TEXT;

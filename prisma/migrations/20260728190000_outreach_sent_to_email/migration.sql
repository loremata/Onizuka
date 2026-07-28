-- Destinatario reale della mail outreach. Due scopi:
--  1. prova di chi ha ricevuto cosa (prima non restava traccia);
--  2. blocco anti doppio invio: l'anagrafica ha ~306 clienti duplicati per
--     telefono e ~120 per email, quindi la stessa persona poteva ricevere piu'
--     sequenze in parallelo sotto ragioni sociali diverse.
ALTER TABLE "OutreachDraft" ADD COLUMN IF NOT EXISTS "sentToEmail" TEXT;
CREATE INDEX IF NOT EXISTS "OutreachDraft_sentToEmail_sentAt_idx"
  ON "OutreachDraft"("sentToEmail", "sentAt");

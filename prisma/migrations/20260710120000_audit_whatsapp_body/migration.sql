-- Messaggio WhatsApp generato dall'audit (kit outreach), da usare se si ottiene il numero del titolare.
ALTER TABLE "DigitalAudit" ADD COLUMN IF NOT EXISTS "outreachWhatsAppBody" TEXT;

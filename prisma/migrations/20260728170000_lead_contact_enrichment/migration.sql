-- Recupero contatti dal sito aziendale (batch cron): timestamp dell'ultimo
-- tentativo per lead, per non risondare lo stesso sito prima di 30 giorni.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "contactEnrichedAt" TIMESTAMP(3);

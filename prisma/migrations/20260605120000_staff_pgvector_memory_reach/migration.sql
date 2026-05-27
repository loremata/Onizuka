-- Ruolo collaboratore (accesso admin limitato)
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE 'STAFF';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Reach click tracking
ALTER TABLE "OutreachDraft" ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3);
ALTER TABLE "OutreachDraft" ADD COLUMN IF NOT EXISTS "clickCount" INTEGER NOT NULL DEFAULT 0;

-- Memoria: flag contenuto cifrato (HIGH + chiave env)
ALTER TABLE "MemoryItem" ADD COLUMN IF NOT EXISTS "contentEncrypted" BOOLEAN NOT NULL DEFAULT false;

-- pgvector (opzionale: richiede CREATE EXTENSION su Supabase)
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "MemoryItem" ADD COLUMN IF NOT EXISTS "embeddingVector" vector(1536);
-- Indice ANN: creare dopo backfill con scripts/backfill-memory-pgvector.mjs se necessario

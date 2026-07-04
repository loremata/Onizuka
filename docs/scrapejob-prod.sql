-- Aggiunge SOLO la tabella ScrapeJob (additivo, non tocca dati/altre tabelle).
-- Eseguire una volta nel SQL Editor di Supabase (progetto di produzione Onizuka).
DO $$ BEGIN
  CREATE TYPE "ScrapeJobStatus" AS ENUM ('QUEUED','RUNNING','DONE','ERROR');
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "ScrapeJob" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "provincia" TEXT NOT NULL,
  "comune" TEXT NOT NULL,
  "registroSlug" TEXT NOT NULL,
  "status" "ScrapeJobStatus" NOT NULL DEFAULT 'QUEUED',
  "phase" TEXT,
  "progressCurrent" INTEGER NOT NULL DEFAULT 0,
  "progressTotal" INTEGER NOT NULL DEFAULT 0,
  "totalFound" INTEGER NOT NULL DEFAULT 0,
  "activeCount" INTEGER NOT NULL DEFAULT 0,
  "excludedCount" INTEGER NOT NULL DEFAULT 0,
  "placesEnriched" INTEGER NOT NULL DEFAULT 0,
  "leadsCreated" INTEGER NOT NULL DEFAULT 0,
  "dedupSkipped" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ScrapeJob_status_createdAt_idx" ON "ScrapeJob"("status","createdAt");
CREATE INDEX IF NOT EXISTS "ScrapeJob_ownerUserId_idx" ON "ScrapeJob"("ownerUserId");

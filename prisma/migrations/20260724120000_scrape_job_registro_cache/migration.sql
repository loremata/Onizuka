-- AlterTable
-- Cache incrementale delle schede registro già scaricate: permette il resume
-- di un job fallito a metà crawl (nullable, nessun default: zero rischio).
ALTER TABLE "ScrapeJob" ADD COLUMN IF NOT EXISTS "registroCacheJson" TEXT;

-- Ripara DB ibrido (migrazioni MVP precedenti + nuove migrazioni Prisma).
-- Esegui con: npx prisma db execute --file prisma/repair-partial-migrations.sql

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "country" TEXT;
UPDATE "Client" SET "country" = 'IT' WHERE "country" IS NULL;
ALTER TABLE "Client" ALTER COLUMN "country" SET DEFAULT 'IT';
ALTER TABLE "Client" ALTER COLUMN "country" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Client_status_idx" ON "Client"("status");

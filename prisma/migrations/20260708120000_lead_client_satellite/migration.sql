-- Lead come satellite del Client: link sempre-attivo "clientId" all'identità (Client).
-- Additivo e a basso rischio (colonna nullable + FK SetNull + indice).

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill 1: lead già convertiti → link al client convertito.
UPDATE "Lead" SET "clientId" = "convertedClientId"
  WHERE "convertedClientId" IS NOT NULL AND "clientId" IS NULL;

-- Backfill 2: prospect dall'audit → link al Client-prospect con la stessa P.IVA.
UPDATE "Lead" AS l SET "clientId" = c."id"
  FROM "Client" AS c
  WHERE l."clientId" IS NULL
    AND l."vatNumber" IS NOT NULL
    AND c."vatNumber" = l."vatNumber";

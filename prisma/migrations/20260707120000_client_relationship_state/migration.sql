-- Stato relazione cliente: LEAD (prospect) / CLIENTE (cliente vero) / EX_CLIENTE.
-- CreateEnum
CREATE TYPE "ClientRelationshipState" AS ENUM ('LEAD', 'CLIENTE', 'EX_CLIENTE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "relationshipState" "ClientRelationshipState" NOT NULL DEFAULT 'CLIENTE';

-- Data: i prospect esistenti (creati da audit/sheet) → LEAD, così escono dalla lista clienti veri.
UPDATE "Client" SET "relationshipState" = 'LEAD'
  WHERE "contactEmail" LIKE 'prospect+%@onizuka.local'
     OR "id" IN (SELECT "convertedClientId" FROM "Lead" WHERE "convertedClientId" IS NOT NULL);

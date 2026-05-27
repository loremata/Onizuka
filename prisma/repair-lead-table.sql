-- Sostituisce la tabella Lead del vecchio MVP con lo schema CRM attuale.

DROP TABLE IF EXISTS "Lead" CASCADE;
DROP TYPE IF EXISTS "LeadStatus";

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'COLD', 'QUALIFIED', 'CONTACTED', 'CONVERTED', 'LOST');

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contactName" TEXT,
    "businessName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vatNumber" TEXT,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW'::"LeadStatus",
    "notes" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "convertedClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lead_convertedClientId_key" ON "Lead"("convertedClientId");
CREATE INDEX "Lead_ownerUserId_idx" ON "Lead"("ownerUserId");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Persona ↔ azienda + reminder preventivo non risposto

CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "fiscalCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PersonClientRole" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonClientRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PersonClientRole_personId_clientId_key" ON "PersonClientRole"("personId", "clientId");
CREATE INDEX "PersonClientRole_clientId_idx" ON "PersonClientRole"("clientId");
CREATE INDEX "PersonClientRole_personId_idx" ON "PersonClientRole"("personId");
CREATE INDEX "Person_ownerUserId_idx" ON "Person"("ownerUserId");
CREATE INDEX "Person_email_idx" ON "Person"("email");

ALTER TABLE "Person" ADD CONSTRAINT "Person_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonClientRole" ADD CONSTRAINT "PersonClientRole_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonClientRole" ADD CONSTRAINT "PersonClientRole_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpportunityQuote" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "OpportunityQuote" ADD COLUMN "noResponseDueAt" TIMESTAMP(3);
CREATE INDEX "OpportunityQuote_noResponseDueAt_idx" ON "OpportunityQuote"("noResponseDueAt");

-- Portale ticket cliente + bozze outreach Reach

CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TYPE "OutreachDraftStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CANCELLED');

CREATE TABLE "ClientTicket" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN'::"TicketStatus",
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientTicket_clientId_idx" ON "ClientTicket"("clientId");
CREATE INDEX "ClientTicket_status_idx" ON "ClientTicket"("status");

ALTER TABLE "ClientTicket" ADD CONSTRAINT "ClientTicket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OutreachDraft" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutreachDraftStatus" NOT NULL DEFAULT 'DRAFT'::"OutreachDraftStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutreachDraft_ownerUserId_idx" ON "OutreachDraft"("ownerUserId");
CREATE INDEX "OutreachDraft_status_idx" ON "OutreachDraft"("status");

ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientTicket" ADD COLUMN "clientReadAt" TIMESTAMP(3);

CREATE TABLE "ClientTicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientTicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientTicketAttachment_ticketId_idx" ON "ClientTicketAttachment"("ticketId");

ALTER TABLE "ClientTicketAttachment" ADD CONSTRAINT "ClientTicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ClientTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

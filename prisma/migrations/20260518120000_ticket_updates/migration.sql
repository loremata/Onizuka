CREATE TABLE "ClientTicketUpdate" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "message" TEXT,
    "status" "TicketStatus",
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientTicketUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientTicketUpdate_ticketId_idx" ON "ClientTicketUpdate"("ticketId");

ALTER TABLE "ClientTicketUpdate" ADD CONSTRAINT "ClientTicketUpdate_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ClientTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

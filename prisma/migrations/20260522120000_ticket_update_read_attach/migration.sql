-- AlterTable
ALTER TABLE "ClientTicketUpdate" ADD COLUMN "clientReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClientTicketAttachment" ADD COLUMN "updateId" TEXT;

-- CreateIndex
CREATE INDEX "ClientTicketAttachment_updateId_idx" ON "ClientTicketAttachment"("updateId");

-- AddForeignKey
ALTER TABLE "ClientTicketAttachment" ADD CONSTRAINT "ClientTicketAttachment_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "ClientTicketUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

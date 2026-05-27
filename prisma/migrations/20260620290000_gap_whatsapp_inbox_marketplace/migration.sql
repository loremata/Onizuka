-- AlterTable
ALTER TABLE "User" ADD COLUMN "dedupeAlertMinGroups" INTEGER;

-- AlterTable
ALTER TABLE "AutomationRuleTemplate" ADD COLUMN "marketplace" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "AutomationRuleTemplate_marketplace_idx" ON "AutomationRuleTemplate"("marketplace");

-- CreateTable
CREATE TABLE "WhatsAppInboundMessage" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT,
    "phoneFrom" TEXT NOT NULL,
    "body" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson" TEXT,

    CONSTRAINT "WhatsAppInboundMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppInboundMessage_waMessageId_key" ON "WhatsAppInboundMessage"("waMessageId");
CREATE INDEX "WhatsAppInboundMessage_receivedAt_idx" ON "WhatsAppInboundMessage"("receivedAt");

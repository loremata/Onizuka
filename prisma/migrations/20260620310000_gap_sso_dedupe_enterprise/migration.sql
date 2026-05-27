-- AlterTable Client
ALTER TABLE "Client" ADD COLUMN "dedupeEmbedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];
ALTER TABLE "Client" ADD COLUMN "ticketSlaHours" INTEGER;

-- AlterTable Referrer
ALTER TABLE "Referrer" ADD COLUMN "googleEmail" TEXT;

CREATE UNIQUE INDEX "Referrer_googleEmail_key" ON "Referrer"("googleEmail") WHERE "googleEmail" IS NOT NULL;

-- AlterTable AutomationRule
ALTER TABLE "AutomationRule" ADD COLUMN "flowBranchesJson" TEXT;

-- AlterTable WhatsAppInboundMessage
ALTER TABLE "WhatsAppInboundMessage" ADD COLUMN "assignedUserId" TEXT;
ALTER TABLE "WhatsAppInboundMessage" ADD COLUMN "repliedAt" TIMESTAMP(3);

CREATE INDEX "WhatsAppInboundMessage_assignedUserId_idx" ON "WhatsAppInboundMessage"("assignedUserId");

-- CreateTable Workspace
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

INSERT INTO "Workspace" ("id", "slug", "name", "createdAt") VALUES ('ws_default', 'default', 'Agenzia principale', CURRENT_TIMESTAMP);

ALTER TABLE "User" ADD COLUMN "workspaceId" TEXT DEFAULT 'ws_default';
ALTER TABLE "Client" ADD COLUMN "workspaceId" TEXT DEFAULT 'ws_default';

ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_workspaceId_idx" ON "User"("workspaceId");
CREATE INDEX "Client_workspaceId_idx" ON "Client"("workspaceId");

-- CreateTable WhatsAppOutboundMessage
CREATE TABLE "WhatsAppOutboundMessage" (
    "id" TEXT NOT NULL,
    "inboundMessageId" TEXT,
    "phoneTo" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateName" TEXT,
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppOutboundMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WhatsAppOutboundMessage_inboundMessageId_idx" ON "WhatsAppOutboundMessage"("inboundMessageId");
CREATE INDEX "WhatsAppOutboundMessage_createdAt_idx" ON "WhatsAppOutboundMessage"("createdAt");

-- CreateTable WhatsAppTemplate
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'it',
    "bodyPreview" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppTemplate_name_languageCode_key" ON "WhatsAppTemplate"("name", "languageCode");

ALTER TABLE "WhatsAppInboundMessage" ADD CONSTRAINT "WhatsAppInboundMessage_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

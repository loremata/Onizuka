-- Social inbox: risposta API + external id
ALTER TABLE "SocialInboxComment" ADD COLUMN "externalId" TEXT;
ALTER TABLE "SocialInboxComment" ADD COLUMN "replyBody" TEXT;
ALTER TABLE "SocialInboxComment" ADD COLUMN "replyExternalId" TEXT;
CREATE UNIQUE INDEX "SocialInboxComment_externalId_key" ON "SocialInboxComment"("externalId") WHERE "externalId" IS NOT NULL;

-- WhatsApp routing per linea
ALTER TABLE "WhatsAppInboundMessage" ADD COLUMN "phoneLineId" TEXT;
ALTER TABLE "WhatsAppInboundMessage" ADD COLUMN "phoneNumberId" TEXT;
CREATE INDEX "WhatsAppInboundMessage_phoneLineId_idx" ON "WhatsAppInboundMessage"("phoneLineId");
CREATE INDEX "WhatsAppInboundMessage_phoneNumberId_idx" ON "WhatsAppInboundMessage"("phoneNumberId");

-- Workspace enterprise
ALTER TABLE "Workspace" ADD COLUMN "databaseSlug" TEXT;
CREATE UNIQUE INDEX "Workspace_databaseSlug_key" ON "Workspace"("databaseSlug") WHERE "databaseSlug" IS NOT NULL;

-- OAuth ERP (enum values added via schema; Prisma migrate may alter enum)
ALTER TYPE "OAuthProvider" ADD VALUE IF NOT EXISTS 'ZUCCHETTI_ERP';
ALTER TYPE "OAuthProvider" ADD VALUE IF NOT EXISTS 'SAP_ERP';

-- Coda automazioni distribuite
CREATE TYPE "AutomationFlowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

CREATE TABLE "AutomationFlowRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "branchId" TEXT,
    "status" "AutomationFlowRunStatus" NOT NULL DEFAULT 'PENDING',
    "payloadJson" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorDetail" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AutomationFlowRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationFlowRun_status_scheduledAt_idx" ON "AutomationFlowRun"("status", "scheduledAt");
CREATE INDEX "AutomationFlowRun_ruleId_idx" ON "AutomationFlowRun"("ruleId");

ALTER TABLE "AutomationFlowRun" ADD CONSTRAINT "AutomationFlowRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationFlowRun" ADD CONSTRAINT "AutomationFlowRun_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Audit cross-workspace
CREATE TABLE "WorkspaceAuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceAuditLog_workspaceId_createdAt_idx" ON "WorkspaceAuditLog"("workspaceId", "createdAt");

ALTER TABLE "WorkspaceAuditLog" ADD CONSTRAINT "WorkspaceAuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceAuditLog" ADD CONSTRAINT "WorkspaceAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppInboundMessage" ADD CONSTRAINT "WhatsAppInboundMessage_phoneLineId_fkey" FOREIGN KEY ("phoneLineId") REFERENCES "WhatsAppPhoneLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "AutomationRuleTrigger" ADD VALUE IF NOT EXISTS 'WHATSAPP_INBOUND';

-- AlterTable
ALTER TABLE "ClientTicket" ADD COLUMN "slaDueAt" TIMESTAMP(3),
ADD COLUMN "slaBreachedAt" TIMESTAMP(3);

CREATE INDEX "ClientTicket_slaDueAt_idx" ON "ClientTicket"("slaDueAt");

-- CreateTable
CREATE TABLE "ReferrerMagicLink" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferrerMagicLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferrerPushSubscription" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferrerPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeErpPushLog" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeErpPushLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialInboxComment" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "clientId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "externalUrl" TEXT,
    "repliedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialInboxComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferrerMagicLink_token_key" ON "ReferrerMagicLink"("token");
CREATE INDEX "ReferrerMagicLink_referrerId_expiresAt_idx" ON "ReferrerMagicLink"("referrerId", "expiresAt");
CREATE UNIQUE INDEX "ReferrerPushSubscription_endpoint_key" ON "ReferrerPushSubscription"("endpoint");
CREATE INDEX "ReferrerPushSubscription_referrerId_idx" ON "ReferrerPushSubscription"("referrerId");
CREATE INDEX "TimeErpPushLog_ownerUserId_createdAt_idx" ON "TimeErpPushLog"("ownerUserId", "createdAt");
CREATE INDEX "SocialInboxComment_receivedAt_idx" ON "SocialInboxComment"("receivedAt");
CREATE INDEX "SocialInboxComment_clientId_idx" ON "SocialInboxComment"("clientId");

ALTER TABLE "ReferrerMagicLink" ADD CONSTRAINT "ReferrerMagicLink_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferrerPushSubscription" ADD CONSTRAINT "ReferrerPushSubscription_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeErpPushLog" ADD CONSTRAINT "TimeErpPushLog_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxComment" ADD CONSTRAINT "SocialInboxComment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

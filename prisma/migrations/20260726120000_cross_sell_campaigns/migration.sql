-- CreateEnum
CREATE TYPE "MarketingConsentBasis" AS ENUM ('NONE', 'SOFT_OPT_IN', 'EXPLICIT');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignEnrollmentStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'EXITED', 'COMPLETED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "CampaignSendStatus" AS ENUM ('SIMULATED', 'SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "marketingConsentBasis" "MarketingConsentBasis" NOT NULL DEFAULT 'SOFT_OPT_IN',
ADD COLUMN     "marketingOptOutAt" TIMESTAMP(3),
ADD COLUMN     "marketingOptOutToken" TEXT;

-- CreateTable
CREATE TABLE "CrossSellCampaign" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "channel" "CampaignChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "targetServiceSlug" TEXT NOT NULL,
    "requiresAnyOwnedSlug" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludesOwnedSlug" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossSellCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossSellCampaignStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossSellCampaignStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEnrollment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "CampaignEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "nextStepAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "exitReason" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSend" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "status" "CampaignSendStatus" NOT NULL DEFAULT 'SIMULATED',
    "trackToken" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrossSellCampaign_key_key" ON "CrossSellCampaign"("key");

-- CreateIndex
CREATE INDEX "CrossSellCampaign_status_priority_idx" ON "CrossSellCampaign"("status", "priority");

-- CreateIndex
CREATE INDEX "CrossSellCampaignStep_campaignId_idx" ON "CrossSellCampaignStep"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CrossSellCampaignStep_campaignId_stepIndex_key" ON "CrossSellCampaignStep"("campaignId", "stepIndex");

-- CreateIndex
CREATE INDEX "CampaignEnrollment_clientId_status_idx" ON "CampaignEnrollment"("clientId", "status");

-- CreateIndex
CREATE INDEX "CampaignEnrollment_campaignId_status_idx" ON "CampaignEnrollment"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignEnrollment_status_nextStepAt_idx" ON "CampaignEnrollment"("status", "nextStepAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSend_trackToken_key" ON "CampaignSend"("trackToken");

-- CreateIndex
CREATE INDEX "CampaignSend_enrollmentId_idx" ON "CampaignSend"("enrollmentId");

-- CreateIndex
CREATE INDEX "CampaignSend_status_scheduledFor_idx" ON "CampaignSend"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "Client_marketingOptOutToken_key" ON "Client"("marketingOptOutToken");

-- AddForeignKey
ALTER TABLE "CrossSellCampaignStep" ADD CONSTRAINT "CrossSellCampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrossSellCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrossSellCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CampaignEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CrossSellCampaignStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sicurezza: RLS sulle nuove tabelle (coerente con 20260724130000_enable_rls_all_tables;
-- l'app usa il ruolo prisma con BYPASSRLS, gli attori pubblici vedono 0 righe).
ALTER TABLE "CrossSellCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrossSellCampaignStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignEnrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignSend" ENABLE ROW LEVEL SECURITY;

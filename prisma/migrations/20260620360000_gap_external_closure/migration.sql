-- CreateEnum
CREATE TYPE "DedupeTrainingJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "DedupeTrainingJob" (
    "id" TEXT NOT NULL,
    "status" "DedupeTrainingJobStatus" NOT NULL DEFAULT 'PENDING',
    "pairsCount" INTEGER NOT NULL DEFAULT 0,
    "datasetS3Key" TEXT,
    "datasetUrl" TEXT,
    "gpuWebhookUrl" TEXT,
    "weightsVersion" INTEGER,
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DedupeTrainingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyPartnerSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "zucchettiOfficial" BOOLEAN NOT NULL DEFAULT false,
    "sapOfficial" BOOLEAN NOT NULL DEFAULT false,
    "zucchettiPartnerRef" TEXT,
    "sapPartnerRef" TEXT,
    "contractSignedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyPartnerSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "databaseCloudProvider" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "databaseCloudRef" TEXT;

-- CreateIndex
CREATE INDEX "DedupeTrainingJob_status_createdAt_idx" ON "DedupeTrainingJob"("status", "createdAt");

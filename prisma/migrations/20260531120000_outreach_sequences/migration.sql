-- CreateEnum
CREATE TYPE "OutreachSequenceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutreachSequenceStepStatus" AS ENUM ('SCHEDULED', 'ACTIVATED', 'SENT', 'SKIPPED', 'CANCELLED');

-- AlterTable
ALTER TABLE "OutreachDraft" ADD COLUMN "sequenceStepId" TEXT;

-- CreateTable
CREATE TABLE "OutreachSequence" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "digitalAuditId" TEXT,
    "name" TEXT NOT NULL,
    "status" "OutreachSequenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutreachSequenceStepStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachDraft_sequenceStepId_key" ON "OutreachDraft"("sequenceStepId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachSequence_digitalAuditId_key" ON "OutreachSequence"("digitalAuditId");

-- CreateIndex
CREATE INDEX "OutreachSequence_ownerUserId_idx" ON "OutreachSequence"("ownerUserId");

-- CreateIndex
CREATE INDEX "OutreachSequence_status_idx" ON "OutreachSequence"("status");

-- CreateIndex
CREATE INDEX "OutreachSequence_clientId_idx" ON "OutreachSequence"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachSequenceStep_sequenceId_stepIndex_key" ON "OutreachSequenceStep"("sequenceId", "stepIndex");

-- CreateIndex
CREATE INDEX "OutreachSequenceStep_sequenceId_idx" ON "OutreachSequenceStep"("sequenceId");

-- CreateIndex
CREATE INDEX "OutreachSequenceStep_status_scheduledFor_idx" ON "OutreachSequenceStep"("status", "scheduledFor");

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_sequenceStepId_fkey" FOREIGN KEY ("sequenceStepId") REFERENCES "OutreachSequenceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_digitalAuditId_fkey" FOREIGN KEY ("digitalAuditId") REFERENCES "DigitalAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequenceStep" ADD CONSTRAINT "OutreachSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

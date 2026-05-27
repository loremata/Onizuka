-- Dedupe model config (training pipeline export/import)
CREATE TABLE "DedupeModelConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL DEFAULT 1,
    "weightsJson" TEXT,
    "datasetNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DedupeModelConfig_pkey" PRIMARY KEY ("id")
);

-- Dead-letter automazioni (dopo max retry)
CREATE TABLE "AutomationFlowRunDeadLetter" (
    "id" TEXT NOT NULL,
    "flowRunId" TEXT,
    "ruleId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationFlowRunDeadLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationFlowRunDeadLetter_createdAt_idx" ON "AutomationFlowRunDeadLetter"("createdAt");

-- Database dedicato per workspace (connection string opzionale)
ALTER TABLE "Workspace" ADD COLUMN "databaseUrl" TEXT;

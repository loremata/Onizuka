-- Referrer IBAN per liquidazioni
ALTER TABLE "Referrer" ADD COLUMN "payoutIban" TEXT;

-- STAFF può eseguire 1ª approvazione ore
ALTER TABLE "User" ADD COLUMN "canApproveTimeEntries" BOOLEAN NOT NULL DEFAULT false;

-- Versioning regole automazione
ALTER TABLE "AutomationRule" ADD COLUMN "ruleVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "AutomationRuleRevision" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRuleRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRuleRevision_ruleId_version_idx" ON "AutomationRuleRevision"("ruleId", "version");

ALTER TABLE "AutomationRuleRevision" ADD CONSTRAINT "AutomationRuleRevision_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRuleRevision" ADD CONSTRAINT "AutomationRuleRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Job scansione dedupe asincrona
CREATE TYPE "DedupeScanStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

CREATE TABLE "DedupeScanRun" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "status" "DedupeScanStatus" NOT NULL DEFAULT 'PENDING',
    "fuzzyIndexedClients" INTEGER NOT NULL DEFAULT 10000,
    "groupCount" INTEGER,
    "summaryJson" TEXT,
    "errorDetail" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DedupeScanRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DedupeScanRun_ownerUserId_startedAt_idx" ON "DedupeScanRun"("ownerUserId", "startedAt");

ALTER TABLE "DedupeScanRun" ADD CONSTRAINT "DedupeScanRun_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

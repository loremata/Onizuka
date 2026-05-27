-- CreateTable
CREATE TABLE "AutomationRuleExecution" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "errorDetail" TEXT,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationRuleExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRuleExecution_ruleId_createdAt_idx" ON "AutomationRuleExecution"("ruleId", "createdAt");
CREATE INDEX "AutomationRuleExecution_createdAt_idx" ON "AutomationRuleExecution"("createdAt");

-- AddForeignKey
ALTER TABLE "AutomationRuleExecution" ADD CONSTRAINT "AutomationRuleExecution_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

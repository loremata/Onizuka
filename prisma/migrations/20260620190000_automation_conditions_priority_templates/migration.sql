-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "AutomationRule" ADD COLUMN "conditionKey" TEXT;
ALTER TABLE "AutomationRule" ADD COLUMN "conditionValue" TEXT;
ALTER TABLE "AutomationRule" ADD COLUMN "emailSubjectTemplate" TEXT;
ALTER TABLE "AutomationRule" ADD COLUMN "emailBodyTemplate" TEXT;
ALTER TABLE "AutomationRule" ADD COLUMN "webhookPayloadTemplate" TEXT;

-- CreateIndex
CREATE INDEX "AutomationRule_ownerUserId_priority_idx" ON "AutomationRule"("ownerUserId", "priority");

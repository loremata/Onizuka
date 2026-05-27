-- AlterEnum
ALTER TYPE "AutomationRuleTrigger" ADD VALUE 'TICKET_CREATED';
ALTER TYPE "AutomationRuleTrigger" ADD VALUE 'FINANCE_OVERDUE_SNAPSHOT';

-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN "webhookUrl" TEXT;
ALTER TABLE "AutomationRule" ADD COLUMN "createFlowTask" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AutomationRule" ADD COLUMN "flowTaskTitle" TEXT;

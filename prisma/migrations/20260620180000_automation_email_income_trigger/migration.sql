-- AlterEnum
ALTER TYPE "AutomationRuleTrigger" ADD VALUE 'FINANCE_INCOME_CREATED';

-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN "notifyEmail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AutomationRule" ADD COLUMN "notifyEmailTo" TEXT;

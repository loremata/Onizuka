-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN "conditionOperator" TEXT NOT NULL DEFAULT 'EQ';
ALTER TABLE "AutomationRule" ADD COLUMN "actionRetryAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AutomationRule" ADD COLUMN "actionRetryBackoffSec" INTEGER NOT NULL DEFAULT 2;

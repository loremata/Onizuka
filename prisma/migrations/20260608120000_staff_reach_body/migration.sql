-- AlterTable
ALTER TABLE "User" ADD COLUMN "staffAllowedModules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "OutreachDraft" ADD COLUMN "bodyAlt" TEXT;
ALTER TABLE "OutreachDraft" ADD COLUMN "abWinner" TEXT;

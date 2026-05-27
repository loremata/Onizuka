-- AlterEnum
ALTER TYPE "OAuthProvider" ADD VALUE 'GOOGLE_GBP';

-- AlterTable
ALTER TABLE "OutreachDraft" ADD COLUMN "abVariantSent" TEXT;

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN "stripeCheckoutSessionId" TEXT;

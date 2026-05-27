-- CreateEnum
CREATE TYPE "ReferrerPayoutStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "Referrer" ADD COLUMN "portalPinHash" TEXT;

-- CreateTable
CREATE TABLE "ReferrerPayout" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "amountEur" DECIMAL(12,2) NOT NULL,
    "status" "ReferrerPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "periodLabel" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferrerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferrerPayout_referrerId_createdAt_idx" ON "ReferrerPayout"("referrerId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReferrerPayout" ADD CONSTRAINT "ReferrerPayout_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

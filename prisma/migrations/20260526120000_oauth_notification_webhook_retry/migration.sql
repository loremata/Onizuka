-- AlterTable
ALTER TABLE "User" ADD COLUMN "notificationRev" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WebhookDelivery" ADD COLUMN "nextRetryAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE_CALENDAR');

-- CreateTable
CREATE TABLE "UserOAuthConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "accountEmail" TEXT,
    "tokenCipher" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOAuthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserOAuthConnection_userId_idx" ON "UserOAuthConnection"("userId");
CREATE UNIQUE INDEX "UserOAuthConnection_userId_provider_key" ON "UserOAuthConnection"("userId", "provider");
CREATE INDEX "WebhookDelivery_nextRetryAt_idx" ON "WebhookDelivery"("nextRetryAt");

-- AddForeignKey
ALTER TABLE "UserOAuthConnection" ADD CONSTRAINT "UserOAuthConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

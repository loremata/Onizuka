-- Publisher multi-tenant: account social per-cliente con token cifrati + scheduler nativo.

-- Enums
CREATE TYPE "SocialConnectionMode" AS ENUM ('MANAGED', 'SELF');
CREATE TYPE "SocialAccountStatus" AS ENUM ('CONNECTED', 'EXPIRED', 'REVOKED');

-- Client: flag brand propri (asset di Lorenzo schedulabili come i clienti)
ALTER TABLE "Client" ADD COLUMN "isOwnBrand" BOOLEAN NOT NULL DEFAULT false;

-- SocialAccount
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "connectionMode" "SocialConnectionMode" NOT NULL DEFAULT 'MANAGED',
    "status" "SocialAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "tokenCipher" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageId" TEXT,
    "igBusinessAccountId" TEXT,
    "locationName" TEXT,
    "authorUrn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialAccount_clientId_platform_externalAccountId_key" ON "SocialAccount"("clientId", "platform", "externalAccountId");
CREATE INDEX "SocialAccount_clientId_idx" ON "SocialAccount"("clientId");
CREATE INDEX "SocialAccount_status_idx" ON "SocialAccount"("status");

ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PostItem: collegamento all'account + esito publish nativo
ALTER TABLE "PostItem" ADD COLUMN "socialAccountId" TEXT;
ALTER TABLE "PostItem" ADD COLUMN "errorDetail" TEXT;
ALTER TABLE "PostItem" ADD COLUMN "publishAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "PostItem_socialAccountId_idx" ON "PostItem"("socialAccountId");

ALTER TABLE "PostItem" ADD CONSTRAINT "PostItem_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

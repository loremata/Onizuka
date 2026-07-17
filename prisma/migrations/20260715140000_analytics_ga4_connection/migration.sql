-- Blocco 2: connessione GA4 (fonti dati non-social) per cliente.

ALTER TYPE "OAuthProvider" ADD VALUE IF NOT EXISTS 'GOOGLE_ANALYTICS';

CREATE TABLE "AnalyticsConnection" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "source" "AnalyticsSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "connectedByUserId" TEXT,
    "status" "SocialAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsConnection_clientId_source_externalId_key" ON "AnalyticsConnection"("clientId", "source", "externalId");
CREATE INDEX "AnalyticsConnection_clientId_idx" ON "AnalyticsConnection"("clientId");

ALTER TABLE "AnalyticsConnection" ADD CONSTRAINT "AnalyticsConnection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

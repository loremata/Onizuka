-- Referrer Microsoft SSO
ALTER TABLE "Referrer" ADD COLUMN "microsoftEmail" TEXT;
CREATE UNIQUE INDEX "Referrer_microsoftEmail_key" ON "Referrer"("microsoftEmail") WHERE "microsoftEmail" IS NOT NULL;

-- Client dedupe pgvector ANN
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "dedupeEmbeddingVector" vector(1536);

-- Automation flow version storage
ALTER TABLE "AutomationRule" ADD COLUMN "visualFlowJson" TEXT;

-- Workspace isolation flag
ALTER TABLE "Workspace" ADD COLUMN "isolated" BOOLEAN NOT NULL DEFAULT false;

-- Staff granular deny-list (azioni vietate es. client.delete)
ALTER TABLE "User" ADD COLUMN "staffDeniedActions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- WhatsApp multi-linee (phone number id Meta)
CREATE TABLE "WhatsAppPhoneLine" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppPhoneLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppPhoneLine_phoneNumberId_key" ON "WhatsAppPhoneLine"("phoneNumberId");
CREATE INDEX "WhatsAppPhoneLine_isDefault_idx" ON "WhatsAppPhoneLine"("isDefault");

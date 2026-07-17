-- Report insight social del "team di esperti" AI, persistito per cliente (upsert per clientId).

CREATE TABLE "SocialInsightReport" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL DEFAULT 90,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "statsJson" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "lensesJson" TEXT,
    "suggestionsJson" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialInsightReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialInsightReport_clientId_key" ON "SocialInsightReport"("clientId");

ALTER TABLE "SocialInsightReport" ADD CONSTRAINT "SocialInsightReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

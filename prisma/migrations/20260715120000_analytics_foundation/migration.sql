-- Fondazione modulo Analytics: serie storiche unificate (social + sito + ads).

CREATE TYPE "AnalyticsSource" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'GBP', 'TIKTOK', 'YOUTUBE', 'GA4', 'GOOGLE_ADS', 'META_ADS');

CREATE TABLE "AnalyticsMetric" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "source" "AnalyticsSource" NOT NULL,
    "metricKey" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsMetric_clientId_source_metricKey_dimension_date_key" ON "AnalyticsMetric"("clientId", "source", "metricKey", "dimension", "date");
CREATE INDEX "AnalyticsMetric_clientId_source_date_idx" ON "AnalyticsMetric"("clientId", "source", "date");
CREATE INDEX "AnalyticsMetric_clientId_metricKey_date_idx" ON "AnalyticsMetric"("clientId", "metricKey", "date");

ALTER TABLE "AnalyticsMetric" ADD CONSTRAINT "AnalyticsMetric_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

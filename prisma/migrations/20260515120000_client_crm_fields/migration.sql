-- CRM: stato pipeline e campi anagrafici estesi su Client

CREATE TYPE "ClientStatus" AS ENUM (
  'LEAD_COLD',
  'LEAD_QUALIFIED',
  'CONTACTED',
  'INTERESTED',
  'APPOINTMENT_SET',
  'QUOTE_SENT',
  'NEGOTIATION',
  'ACTIVE_CLIENT',
  'DORMANT',
  'LOST',
  'TO_REACTIVATE'
);

ALTER TABLE "Client" ADD COLUMN "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE_CLIENT'::"ClientStatus";

ALTER TABLE "Client" ADD COLUMN "notes" TEXT;

ALTER TABLE "Client" ADD COLUMN "vatNumber" TEXT;

ALTER TABLE "Client" ADD COLUMN "phone" TEXT;

ALTER TABLE "Client" ADD COLUMN "website" TEXT;

ALTER TABLE "Client" ADD COLUMN "address" TEXT;

ALTER TABLE "Client" ADD COLUMN "city" TEXT;

ALTER TABLE "Client" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'IT';

CREATE INDEX "Client_status_idx" ON "Client"("status");

-- PUNTO-SITUA-DEFINITIVO: ClientKind, macro-categorie, stati prospect, template brand

CREATE TYPE "ClientKind" AS ENUM ('PRIVATE', 'BUSINESS');
CREATE TYPE "ClientMacroCategory" AS ENUM ('RETAIL_STORE', 'DIGITAL_AI', 'MIXED');
CREATE TYPE "CommercialProspectStage" AS ENUM (
  'PROSPECT_ENTERED',
  'AUDIT_IN_PROGRESS',
  'AUDIT_COMPLETED',
  'REPORT_GENERATED',
  'PROPOSAL_GENERATED',
  'AWAITING_SEND_APPROVAL',
  'FIRST_AUDIT_MAIL_SENT',
  'FOLLOW_UP_SCHEDULED',
  'FOLLOW_UP_SENT',
  'RESPONSE_RECEIVED',
  'CALL_SCHEDULED',
  'QUOTE_SENT',
  'IN_NEGOTIATION',
  'WON',
  'LOST',
  'NURTURING'
);

ALTER TABLE "Client" ADD COLUMN "kind" "ClientKind";
ALTER TABLE "Client" ADD COLUMN "fiscalCode" TEXT;
ALTER TABLE "Client" ADD COLUMN "clientMacroCategory" "ClientMacroCategory";

ALTER TABLE "Lead" ADD COLUMN "fiscalCode" TEXT;
ALTER TABLE "Lead" ADD COLUMN "clientMacroCategory" "ClientMacroCategory";
ALTER TABLE "Lead" ADD COLUMN "commercialProspectStage" "CommercialProspectStage";

ALTER TABLE "EcosystemBrand" ADD COLUMN "proposalEmailSubjectTemplate" TEXT;
ALTER TABLE "EcosystemBrand" ADD COLUMN "proposalEmailBodyTemplate" TEXT;

CREATE INDEX "Client_kind_idx" ON "Client"("kind");
CREATE INDEX "Client_clientMacroCategory_idx" ON "Client"("clientMacroCategory");
CREATE INDEX "Client_fiscalCode_idx" ON "Client"("fiscalCode");

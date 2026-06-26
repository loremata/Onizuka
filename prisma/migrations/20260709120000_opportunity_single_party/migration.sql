-- Esclusione mutua: un'opportunità è collegata a UN solo soggetto (cliente o lead).
-- Backfill: dove entrambi presenti, il cliente vince → azzera leadId.
UPDATE "Opportunity" SET "leadId" = NULL
  WHERE "clientId" IS NOT NULL AND "leadId" IS NOT NULL;

-- Vincolo DB: clientId e leadId non possono essere entrambi valorizzati.
ALTER TABLE "Opportunity" ADD CONSTRAINT "opportunity_single_party"
  CHECK ("clientId" IS NULL OR "leadId" IS NULL);

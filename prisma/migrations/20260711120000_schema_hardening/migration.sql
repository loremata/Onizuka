-- Hardening schema (audit sistemica 27/06): indice mancante, default sicuro,
-- vincoli unique fiscali (dedup P.IVA/CF), CHECK idempotente, pulizia orfani.

-- 1. Indice sul filtro principale della lista clienti (era assente → seq scan).
CREATE INDEX IF NOT EXISTS "Client_relationshipState_idx" ON "Client"("relationshipState");

-- 2. Default più sicuro: un record creato senza stato esplicito è un LEAD, non un
--    finto CLIENTE (tutti i percorsi attuali lo impostano comunque esplicitamente).
ALTER TABLE "Client" ALTER COLUMN "relationshipState" SET DEFAULT 'LEAD';

-- 3. Unique parziali normalizzati su P.IVA/CF (impediscono doppioni a livello DB).
--    Espressione allineata a src/lib/client-kind.ts. Verificato: 0 duplicati attuali.
CREATE UNIQUE INDEX IF NOT EXISTS "Client_vatNumber_norm_unique"
  ON "Client" (UPPER(REGEXP_REPLACE(TRIM("vatNumber"), '\s', '', 'g')))
  WHERE "vatNumber" IS NOT NULL AND TRIM("vatNumber") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "Client_fiscalCode_norm_unique"
  ON "Client" (UPPER(REGEXP_REPLACE(TRIM("fiscalCode"), '\s', '', 'g')))
  WHERE "fiscalCode" IS NOT NULL AND TRIM("fiscalCode") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "Person_owner_fiscalCode_norm_unique"
  ON "Person" ("ownerUserId", UPPER(REGEXP_REPLACE(TRIM("fiscalCode"), '\s', '', 'g')))
  WHERE "fiscalCode" IS NOT NULL AND TRIM("fiscalCode") <> '';

-- 4. CHECK mutua esclusione clientId/leadId su Opportunity, idempotente
--    (così un reset/recreate del DB non lo perde silenziosamente).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_single_party') THEN
    ALTER TABLE "Opportunity"
      ADD CONSTRAINT "opportunity_single_party" CHECK ("clientId" IS NULL OR "leadId" IS NULL);
  END IF;
END $$;

-- 5. Pulizia: azzera i digitalAuditId della coda che puntano ad audit non più esistenti.
UPDATE "AuditSheetQueueItem" a
  SET "digitalAuditId" = NULL
  WHERE a."digitalAuditId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "DigitalAudit" d WHERE d.id = a."digitalAuditId");

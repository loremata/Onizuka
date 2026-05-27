-- RF-01 — Indici UNIQUE parziali (PostgreSQL)
-- PREREQUISITO: npm run fiscal:audit-duplicates → 0 duplicati bloccanti
-- APPLICAZIONE: npm run fiscal:apply-unique-indexes -- --execute
-- ROLLBACK: vedi docs/FISCAL-IDENTITY-ROLLBACK.md

-- Espressione allineata a src/lib/client-kind.ts (trim, rimuovi spazi, UPPER)

CREATE UNIQUE INDEX IF NOT EXISTS "Client_vatNumber_norm_unique"
ON "Client" (UPPER(REGEXP_REPLACE(TRIM("vatNumber"), '\s', '', 'g')))
WHERE "vatNumber" IS NOT NULL
  AND TRIM("vatNumber") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "Client_fiscalCode_norm_unique"
ON "Client" (UPPER(REGEXP_REPLACE(TRIM("fiscalCode"), '\s', '', 'g')))
WHERE "fiscalCode" IS NOT NULL
  AND TRIM("fiscalCode") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "Person_owner_fiscalCode_norm_unique"
ON "Person" ("ownerUserId", UPPER(REGEXP_REPLACE(TRIM("fiscalCode"), '\s', '', 'g')))
WHERE "fiscalCode" IS NOT NULL
  AND TRIM("fiscalCode") <> '';

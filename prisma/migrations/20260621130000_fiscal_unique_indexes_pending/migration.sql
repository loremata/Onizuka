-- RF-01 placeholder (no-op).
-- Gli indici UNIQUE parziali NON sono applicati automaticamente da migrate deploy
-- per evitare failure su DB con duplicati esistenti.
--
-- Procedura sicura:
--   1. npm run fiscal:audit-duplicates
--   2. npm run fiscal:normalize-values -- --execute   (opzionale)
--   3. Risolvere duplicati manualmente /admin/crm/dedupe
--   4. npm run fiscal:apply-unique-indexes -- --execute
--
-- SQL: prisma/sql/fiscal-unique-indexes.sql
-- Rollback: docs/FISCAL-IDENTITY-ROLLBACK.md

SELECT 1;

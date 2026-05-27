# Fiscal identity — rollback indici UNIQUE

## Applicazione

```bash
npm run fiscal:audit-duplicates
npm run fiscal:apply-unique-indexes          # dry-run
npm run fiscal:apply-unique-indexes -- --execute
```

## Rollback (PostgreSQL)

```sql
DROP INDEX IF EXISTS "Client_vatNumber_norm_unique";
DROP INDEX IF EXISTS "Client_fiscalCode_norm_unique";
DROP INDEX IF EXISTS "Person_owner_fiscalCode_norm_unique";
```

Nessuna modifica ai dati: solo rimozione vincoli.

## Se la migration Prisma placeholder è stata registrata

```bash
# Solo se necessario annullare la voce in _prisma_migrations (ambiente dev):
# DELETE FROM "_prisma_migrations" WHERE migration_name = '20260621130000_fiscal_unique_indexes_pending';
```

Non eseguire DELETE in produzione senza backup e revisione ops.

# Ambiente staging Onizuka

Staging **separato** da produzione (`onizuka.it`) e da Vercel Preview (branch PR).

## Prerequisiti

| Risorsa | Note |
|---------|------|
| Progetto Vercel | es. `onizuka-staging`, branch `staging` o deploy manuale |
| Supabase staging | DB dedicato EU, **mai** condiviso con prod |
| DNS (opz.) | `staging.onizuka.it` → progetto Vercel staging |
| `.env.staging` locale | Copia da `.env.staging.example` (non committare segreti) |

## Procedura passo-passo

### 1. Creare DB Supabase staging

1. Nuovo progetto Supabase (regione EU).
2. Annota il **project ref** (es. `abcdef` da `db.abcdef.supabase.co`).
3. Crea snapshot/backup prima di ogni migrate importante.

### 2. Configurare Vercel staging

1. Secondo progetto Vercel collegato allo stesso repo.
2. Copia variabili da `vercel-env.staging.template`.
3. Imposta **Production** env del progetto staging (non confondere con prod):
   - `ONIZUKA_ENV=staging`
   - `ONIZUKA_STAGING_DB_MARKER=<ref supabase>`
   - `NEXTAUTH_URL=https://…` (URL staging)
   - `DATABASE_URL` = pooler 6543
   - `DIRECT_URL` = direct 5432
4. Deploy branch `staging` o trigger manuale.

### 3. Env locale per operazioni DB

```bash
cp .env.staging.example .env.staging
# Compila DATABASE_URL, DIRECT_URL, marker, NEXTAUTH_URL, PLAYWRIGHT_BASE_URL
```

### 4. Validare configurazione

```bash
npm run staging:validate
```

Verifica: `ONIZUKA_ENV=staging`, marker presente, `prisma validate` OK.

### 5. Migration staging

```bash
# Backup Supabase prima!
ONIZUKA_STAGING_CONFIRM=yes npm run staging:migrate
```

Sequenza interna: `validate` → `migrate status` → `migrate deploy` → `generate`.

**Rollback:** ripristina snapshot Supabase staging.

### 6. Seed staging

```bash
ONIZUKA_STAGING_CONFIRM=yes npm run staging:seed
```

Crea account `admin@agency.com` / `admin123` e dati prefissati `STAGING TEST` (lead, client, opp, audit, task, quote draft).

### 7. Commercial gate

```bash
npm run staging:commercial-gate
```

22+ smoke (schema, audit VAT, sheet dominio, lead-only opp, quote-no-response task, dashboard KPI, email disabilitata).

### 8. E2E remoti

Prerequisito: app staging deployata e raggiungibile.

```bash
# In .env.staging: PLAYWRIGHT_BASE_URL=https://your-staging.vercel.app
npm run staging:test:e2e:dashboard
npm run staging:test:e2e:audit-crm
npm run staging:test:e2e
```

Regole Playwright:

- `PLAYWRIGHT_BASE_URL` impostato → **no** webServer locale
- `PLAYWRIGHT_BASE_URL` assente → webServer locale (`npm run dev`)
- Mai URL `onizuka.it` (produzione)

### 9. Leggere report

- Gate: stdout `ST-02 gate: PASS` / exit 0
- E2E: `n passed` in output Playwright
- `/admin/settings` → Stato deploy: `onizukaEnv: staging`, nessun errore marker

### 10. Cleanup

```bash
ONIZUKA_STAGING_CONFIRM=yes npm run staging:cleanup
```

Rimuove record `STAGING TEST`, `ST02_*`, `E2E Audit CRM`, ecc.

## Script npm

| Script | Descrizione |
|--------|-------------|
| `staging:validate` | Guard + `prisma validate` + `migrate status` |
| `staging:migrate` | `migrate deploy` su staging (richiede `ONIZUKA_STAGING_CONFIRM=yes`) |
| `staging:seed` | Seed dati test staging |
| `staging:commercial-gate` | Smoke commerciale 22+ check |
| `staging:cleanup` | Pulizia record test |
| `staging:test:e2e:dashboard` | E2E dashboard su URL remoto |
| `staging:test:e2e:audit-crm` | E2E audit CRM remoto |
| `staging:test:e2e` | Entrambi gli E2E commerciali |

## Protezioni anti-produzione

Helper: `src/lib/staging-guard.ts`

- `assertStagingEnvironment()` — migrate/seed/cleanup remoti
- `assertNotProductionDatabase()` — blocca URL prod
- `assertSafeE2EBaseUrl()` — E2E mai su onizuka.it
- `assertCommercialGateSafe()` — gate commerciale

Condizioni blocco:

- `ONIZUKA_ENV=production` o `DATABASE_URL` con hint prod
- `NEXTAUTH_URL` → `onizuka.it`
- `PLAYWRIGHT_BASE_URL` → produzione
- Staging remoto senza `ONIZUKA_STAGING_DB_MARKER`
- Operazioni rischiose senza `ONIZUKA_STAGING_CONFIRM=yes`

## Servizi esterni

| Servizio | Staging |
|----------|---------|
| PostgreSQL | Supabase staging dedicato |
| Email quote/ticket/digest | `QUOTE_NOTIFY_EMAIL=0` (default seed) o Mailtrap |
| Website probe audit | Reale su staging; mock con `PLAYWRIGHT_E2E=1` in E2E |
| Google Sheet / Places | Opzionale; lasciare vuoto se non serve |
| S3 media | Bucket staging separato |
| Cron Vercel | `CRON_SECRET` staging dedicato |

## Preview vs staging

| | Vercel Preview | Staging dedicato |
|---|----------------|------------------|
| Trigger | PR / branch | Branch `staging` |
| DB | Spesso dev condiviso | Supabase isolato |
| `ONIZUKA_ENV` | unset | `staging` |
| Gate commerciale | Solo locale consigliato | Obbligatorio pre-prod |

## Criteri GO / NO-GO

**GO staging tecnico (pre-prod):**

- `staging:migrate` OK
- `staging:seed` OK
- `staging:commercial-gate` 22+ OK
- `staging:test:e2e:*` verdi su URL staging
- `/admin/settings` mostra staging senza warning DB

**NO-GO produzione** finché tutti i punti sopra non sono verdi su **staging remoto reale**.

## Checklist rapida post-setup

```bash
npm run staging:validate
ONIZUKA_STAGING_CONFIRM=yes npm run staging:migrate
ONIZUKA_STAGING_CONFIRM=yes npm run staging:seed
npm run staging:commercial-gate
npm run staging:test:e2e
```

Vedi anche: [ONIZUKA_FULL_FLOW_AUDIT.md](../ONIZUKA_FULL_FLOW_AUDIT.md) (ST-04), [DEPLOY.md](./DEPLOY.md).

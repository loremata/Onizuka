# Onizuka — Playbook go-live produzione

_Guida operativa per completare le **17 voci manuali** di [PASSI-MANCANTI.md](../PASSI-MANCANTI.md).  
Esegui in ordine; spunta in PASSI-MANCANTI quando fatto in **produzione**.

**Prerequisiti:** account Supabase, Cloudflare R2, Vercel, Hostinger DNS, Gmail SMTP (o altro), repo GitHub.

---

## #01 — Repository GitHub

- [ ] `git push origin main` (o branch di produzione collegato a Vercel)
- [ ] Verifica CI verde (`.github/workflows/ci.yml`)
- [ ] Protezione branch main (opzionale)

---

## #02 — Supabase (EU) + Cloudflare R2

### Supabase

1. [console.supabase.com](https://supabase.com/dashboard) → **New project** → regione **EU** (Frankfurt o closest).
2. **Settings → Database:**
   - **Connection string → Transaction pooler** (porta **6543**, `?pgbouncer=true`) → `DATABASE_URL` Vercel
   - **Connection string → Direct** (porta **5432**) → `DIRECT_URL` (solo migrate da locale/CI)
3. Abilita estensione **vector** (SQL: `create extension if not exists vector;`) se non già in migrate.
4. Copia password DB in password manager.

### Cloudflare R2

1. R2 → **Create bucket** (es. `onizuka-prod`).
2. **Manage R2 API Tokens** → token con Read/Write sul bucket.
3. Variabili Vercel (vedi `vercel-env.template`):

```env
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=onizuka-prod
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
S3_FORCE_PATH_STYLE=1
S3_PUBLIC_URL=https://<pub>.r2.dev   # o custom domain CDN
```

4. [ ] Verifica post-deploy: `GET https://onizuka.it/api/health/ready` → `"storage":"s3"`

---

## #03 — DATABASE_URL (pooler 6543)

- [ ] Vercel → Project → Settings → Environment Variables → **Production**
- [ ] Incolla `DATABASE_URL` da Supabase pooler (include `pgbouncer=true`)
- [ ] Locale: `npm run deploy:check` con env prod caricato

---

## #04 — DIRECT_URL (5432)

- [ ] Stessa console Supabase → direct connection → `DIRECT_URL` su Vercel (per sicurezza, anche se migrate da locale)
- [ ] **Non** usare pooler per `prisma migrate deploy`

---

## #05 — prisma migrate deploy

Da macchina con `DIRECT_URL` produzione:

```bash
DIRECT_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" npm run db:deploy
```

- [ ] Output: **65** migrazioni applicate (incl. `20260620600000_person_quote_no_response`), nessun errore
- [ ] Probe batch F: `npx tsx scripts/probe-batch-f-migration.ts` (exit 0)
- [ ] `/admin/go-live` → DB probe verde

---

## #06 — Seed e password reali

- [ ] **Primo deploy:** `npm run db:seed` solo se DB vuoto (non in prod ripetuto)
- [ ] **Opzionale (referenti esistenti):** `npx tsx scripts/backfill-person-from-contacts.mjs` dopo migrate Person
- [ ] Cambia password `admin@agency.com` e utenti demo da `/admin/users` → reset password
- [ ] `mustChangePassword` / disattiva account demo se non servono
- [ ] Nessuna password `admin123` / `client123` in produzione

---

## #07 — NEXTAUTH_URL + NEXTAUTH_SECRET

```env
NEXTAUTH_URL=https://onizuka.it
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

- [ ] Secret ≥ 32 caratteri, unico per produzione
- [ ] Preview/staging: URL dedicati se usi [STAGING.md](./STAGING.md)

---

## #08 — ONIZUKA_PRIMARY_HOST

```env
ONIZUKA_PRIMARY_HOST=onizuka.it
```

- [ ] Redirect host canonico e cookie coerenti
- [ ] `deploy:check` non segnala primary host mancante

---

## #09 — Storage S3/R2 (produzione)

- [ ] Tutte le variabili S3 in § #02 su Vercel Production
- [ ] **Rimuovi** `ALLOW_LOCAL_UPLOAD_SERVE` da Production
- [ ] Test upload: `/admin/posts/new` → salva media → URL pubblico R2

---

## #10 — CRON_SECRET + cron Vercel

```env
CRON_SECRET=<openssl rand -base64 32>
```

- [ ] Stesso valore in Vercel e GitHub Actions (§ #16)
- [ ] `vercel.json` cron paths attivi (piano Vercel con cron)
- [ ] Smoke: `curl -H "Authorization: Bearer $CRON_SECRET" https://onizuka.it/api/cron/notifications` → 200

---

## #11 — DNS Hostinger → Vercel

In pannello Hostinger (dominio **onizuka.it**):

| Record | Valore |
|--------|--------|
| **A** `@` | IP indicato da Vercel Domains |
| **CNAME** `www` | `cname.vercel-dns.com` |

- [ ] Vercel → Domains → aggiungi `onizuka.it` + `www.onizuka.it`
- [ ] Attendi SSL automatico (Let's Encrypt Vercel)
- [ ] `https://onizuka.it` e `https://www.onizuka.it` rispondono 200

Vedi anche [HOSTINGER-MARKETING.md](./HOSTINGER-MARKETING.md) (sito marketing separato).

---

## #12 — Smoke HTTP produzione

```bash
BASE_URL=https://onizuka.it CRON_SECRET=<secret> npm run smoke:prod
```

- [ ] 7 route pubbliche OK
- [ ] 3 cron OK (se CRON_SECRET impostato)

---

## #13 — /admin/go-live

- [ ] Login admin produzione
- [ ] Card **Passi mancanti** → 0 voci **obbligatorie** todo
- [ ] Diagnostica env verde

---

## #14 — Login admin + upload produzione

- [ ] Login con utente reale (non seed)
- [ ] Crea post test con immagine → media su R2
- [ ] Cliente: login portale → approva post test
- [ ] Elimina dati test se necessario

---

## #15 — SMTP

Gmail (esempio in `vercel-env.template`):

```env
GMAIL_SMTP_HOST=smtp.gmail.com
GMAIL_SMTP_PORT=587
GMAIL_SMTP_SECURE=0
GMAIL_SMTP_USER=...
GMAIL_SMTP_PASSWORD=<app password>
GMAIL_SMTP_FROM=noreply@onizuka.it
NOTIFY_DIGEST_EMAIL=1
QUOTE_NOTIFY_EMAIL=1
TICKET_NOTIFY_EMAIL=1
```

- [ ] `/api/health/ready` → `"smtp":true`
- [ ] Test digest o invio preventivo da CRM

---

## #16 — Secrets GitHub Actions

Repository → **Settings → Secrets and variables → Actions**:

| Secret | Valore |
|--------|--------|
| `CRON_SECRET` | = Vercel |
| `ONIZUKA_CRON_URL` | `https://onizuka.it/api/cron/notifications` |
| `ONIZUKA_CRON_WEBHOOK_RETRY_URL` | `https://onizuka.it/api/cron/webhook-retry` |
| `ONIZUKA_CRON_REACH_URL` | `https://onizuka.it/api/cron/reach-sequences` |
| `ONIZUKA_CRON_AUDIT_SHEET_URL` | `https://onizuka.it/api/cron/audit-sheet-queue` |
| `ONIZUKA_CRON_DEDUPE_URL` | `https://onizuka.it/api/cron/dedupe-training` |

Per migrate manuale: `SUPABASE_DIRECT_URL` (workflow `migrate-production.yml`).

- [ ] Esegui workflow **cron-notifications** manualmente → success
- [ ] Dettaglio: [.github/workflows/README.md](../.github/workflows/README.md)

---

## #17 — Upstash Redis

1. [console.upstash.com](https://console.upstash.com) → database **EU**
2. Copia REST URL + token:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] `/api/health/ready` → `upstashLoginRateLimit` / `redisApiRateLimit` true
- [ ] Rate limit login e API n8n attivi

---

## #18 — Test webhook (consigliato)

- [ ] `/admin/webhooks` → crea subscription test (Webhook.site o n8n)
- [ ] Approva un post → delivery **POST_APPROVED** con firma HMAC
- [ ] Retry da UI se fallito

---

## #19 — deploy:verify

```bash
BASE_URL=https://onizuka.it CRON_SECRET=<secret> npm run passi-mancanti:prod
```

- [ ] `deploy:check` OK
- [ ] Smoke prod OK

---

## Verifica finale

```bash
npm run passi-mancanti:prod
```

Checklist browser: PASSI-MANCANTI §4 «Manuale post-deploy prod».

### Post-migrate (maggio 2026)

- [ ] Migrazione `20260620600000_person_quote_no_response` applicata
- [ ] `npx tsx scripts/backfill-person-from-contacts.mjs` se hai già referenti in `ClientContact`
- [ ] Cron notifications risponde con `quoteNoResponse` nel JSON (campo opzionale)
- [ ] Flusso audit: vedi [AUDIT-OUTREACH-FLOW.md](./AUDIT-OUTREACH-FLOW.md)

---

_Riferimento deploy: [DEPLOY.md](./DEPLOY.md) · presentazione: [PRESENTAZIONE-ONIZUKA.md](./PRESENTAZIONE-ONIZUKA.md) · flusso audit: [AUDIT-OUTREACH-FLOW.md](./AUDIT-OUTREACH-FLOW.md)_

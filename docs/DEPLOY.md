# Deploy Onizuka — Vercel + Supabase + onizuka.it

Guida tecnica produzione. **Checklist da spuntare:** [PASSI-MANCANTI.md](../PASSI-MANCANTI.md).

## Architettura

| Componente | Servizio |
|------------|----------|
| App | **Vercel** |
| DB | **Supabase** (pooler 6543, direct 5432 per migrate) |
| Media | **Cloudflare R2** (obbligatorio su Vercel) |
| DNS | **Hostinger** → Vercel |
| SMTP / n8n / Upstash | Opzionali (vedi `vercel-env.template`) |

---

## Primo deploy da zero (sintesi)

1. Push codice su **GitHub** (`.env` non in repo).
2. Crea **Supabase** (EU) → `DATABASE_URL` (6543) + `DIRECT_URL` (5432).
3. Crea bucket **R2** → variabili `S3_*` su Vercel.
4. Import repo su **Vercel** → copia `vercel-env.template`.
5. `DIRECT_URL=… npm run db:deploy` dal PC.
6. DNS Hostinger: A `@` → Vercel, CNAME `www` → `cname.vercel-dns.com`.
7. `BASE_URL=https://onizuka.it CRON_SECRET=… npm run passi-mancanti:prod`.

Verifica env prima del push: `npm run deploy:check` o `npm run passi-mancanti:prod`.

---

## 1. Supabase

1. [supabase.com](https://supabase.com) → progetto EU.
2. **Transaction pooler** (6543) → `DATABASE_URL` su Vercel.
3. **Direct** (5432) → `DIRECT_URL` (solo migrate).

```bash
DIRECT_URL="postgresql://…" npm run db:deploy
# opzionale una tantum:
DIRECT_URL="postgresql://…" npm run db:seed
```

Cambia password account demo dopo seed.

## 2. Upstash (consigliato)

`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — rate limit login condiviso su Vercel.

## 3. Cloudflare R2

```env
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=onizuka-media
S3_ACCESS_KEY=…
S3_SECRET_KEY=…
S3_FORCE_PATH_STYLE=1
S3_PUBLIC_URL=https://media.onizuka.it
```

Non usare `ALLOW_LOCAL_UPLOAD_SERVE` su Vercel.

## 4. Vercel

Variabili minime: `NEXTAUTH_URL=https://onizuka.it`, `NEXTAUTH_SECRET`, `ONIZUKA_PRIMARY_HOST=onizuka.it`, `CRON_SECRET`, `S3_*`, DB URLs.

Cron in `vercel.json` → `/api/cron/notifications` (06:00 UTC).

## 5. DNS Hostinger

| Tipo | Nome | Valore |
|------|------|--------|
| A | `@` | IP Vercel (es. 76.76.21.21) |
| CNAME | `www` | `cname.vercel-dns.com` |

Aggiungi domini in Vercel → Domains. SSL automatico.

## 6. Verifica

```bash
npm run passi-mancanti:prod
# oppure dopo deploy:
BASE_URL=https://onizuka.it CRON_SECRET=… npm run passi-mancanti:prod
```

## 7. Migrazioni CI

Workflow `.github/workflows/migrate-production.yml` con secret `SUPABASE_DIRECT_URL`.

## 8. Staging

Vedi [STAGING.md](./STAGING.md).

## Riferimenti

- Template env: `vercel-env.template` · esempio locale: `env.local.example`
- Cron GHA: `.github/workflows/README.md`
- `.env.example` (variabili complete)

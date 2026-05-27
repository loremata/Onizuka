# Onizuka — Passi mancanti (checklist unica)

**Unico documento** per tutto ciò che resta da fare prima/dopo il go-live su **onizuka.it**.

| Dove | Ruolo |
|------|--------|
| **Questo file** | Elenco completo — spunta manualmente |
| **`/admin/go-live`** | Checklist live (env, DB, password) |
| **`npm run passi-mancanti:check`** | Verifica repo + `.env` + `.env.local` |
| **`npm run local:setup`** | Genera `.env.local` (CRON_SECRET + upload locale) |
| **`npm run passi-mancanti:full`** | Check + smoke/cron + Jest upload (senza browser) |
| **`npm run passi-mancanti:e2e`** | Tutti gli E2E PASSI-MANCANTI (`--workers=1`) |
| **`npm run passi-mancanti:prod`** | `deploy:check` + smoke su `BASE_URL` https (post-deploy) |
| `src/lib/passi-mancanti-catalog.ts` | Numeri 1–30 |

**Stato codice:** prodotto **completo**. Le voci sotto sono **ops** (produzione) salvo **[repo]** o **locale**.

Riferimenti: [docs/DEPLOY.md](./docs/DEPLOY.md) · [docs/README.md](./docs/README.md) · [.github/workflows/README.md](./.github/workflows/README.md)

---

## Stato avanzamento

| Area | Stato |
|------|--------|
| Codice + batch F/G | **Fatto** |
| Docker locale **pgvector** (`pgvector/pgvector:pg16`) | **Fatto** |
| **`npm run db:deploy`** su DB locale (65 migrazioni, incl. Person + quote reminder) | **Fatto** (dopo `20260620600000`) |
| Probe `ClientOnboardingItem` (batch F) | **Fatto** |
| Smoke locale `BASE_URL=http://localhost:3000 npm run smoke:prod` | **Fatto** (7 route) |
| Playwright `e2e/passi-mancanti-routes.spec.ts` | **Fatto** (5 test) |
| Playwright `e2e/passi-mancanti-admin.spec.ts` | **Fatto** (2 test, 11 route + onboarding/impegni) |
| **`npm run passi-mancanti:local`** | **Fatto** (check + smoke; cron se `CRON_SECRET`) |
| **`npm run db:seed:e2e`** | **Fatto** (fix `mustChangePassword` su account demo) |
| **`passi-mancanti:check`** con `.env` + `.env.local` | **Fatto** (#10 CRON done; #9 storage locale → warn) |
| **`npm run local:setup`** → `.env.local` | **Fatto** |
| Cron locale (`passi-mancanti:local` + E2E cron) | **Fatto** (3 endpoint) |
| Upload locale (`post-media-upload.local` + storage Jest) | **Fatto** |
| E2E PASSI (`passi-mancanti:e2e`) | **10/11** (setup admin + route + cron; upload UI opzionale) |
| Upload UI E2E | **Coperto da Jest** `post-media-upload.local` |
| **Locale automatico** (`passi-mancanti:full`) | **Fatto** (maggio 2026 — check + smoke 7/7 + cron 3/3 + Jest) |
| **Jest completo** | **Fatto** — **227/227** test |
| **Produzione** (Supabase, R2, Vercel, DNS) | **Da fare** — playbook [docs/GO-LIVE-OPS-PLAYBOOK.md](./docs/GO-LIVE-OPS-PLAYBOOK.md) |
| **Slide / PDF presentazione** | **Fatto** — `docs/presentazione/` · `npm run presentazione:pdf` |

### Comandi eseguiti in locale (maggio 2026)

```bash
npm run db:up                    # Postgres pgvector porta 5433
npx prisma migrate resolve --rolled-back "20260605120000_staff_pgvector_memory_reach"  # solo se migrate fallita su image vecchia
npm run db:deploy                # tutte le migrazioni applicate
npx tsx scripts/probe-batch-f-migration.ts   # exit 0
npm run passi-mancanti:check
npm run passi-mancanti:local     # check + smoke (cron se CRON_SECRET)
npm run dev
npx playwright test e2e/passi-mancanti-routes.spec.ts
npm run db:seed:e2e
npx playwright test e2e/passi-mancanti-admin.spec.ts --workers=1
```

---

## Ambiente locale (Docker) — checklist

- [x] Docker Desktop avviato
- [x] `npm run db:up` (immagine `pgvector/pgvector:pg16`)
- [x] `DATABASE_URL` + `DIRECT_URL` in `.env` (porta **5433**)
- [x] `npm run db:deploy` — migrazioni incl. `20260620600000_person_quote_no_response`
- [x] Batch F: tabella `ClientOnboardingItem` presente
- [x] `NEXTAUTH_URL` + `NEXTAUTH_SECRET` in `.env`
- [x] Smoke HTTP locale (health, walk-in, login, robots, security.txt)
- [x] E2E route pubbliche Playwright
- [x] E2E admin `passi-mancanti-admin.spec.ts` (dopo `db:seed:e2e`, `--workers=1`)
- [x] `npm run passi-mancanti:local` (check + smoke HTTP)
- [x] `npm run local:setup` → `.env.local` (`CRON_SECRET`, `ALLOW_LOCAL_UPLOAD_SERVE`)
- [x] `npm run passi-mancanti:local` — cron 3/3 + smoke 7/7
- [x] `npx playwright test e2e/passi-mancanti-cron.spec.ts`
- [x] Upload pipeline: `npm test -- storage-local-upload post-media-upload.local`
- [x] `npm run passi-mancanti:full` (check + local + Jest)
- [x] E2E `passi-mancanti:e2e` — 10/11 (upload UI: usare Jest o login cliente manuale se flaky)

Se migrate fallisce con `extension "vector" is not available`: ricrea container con `docker compose up -d --force-recreate postgres` (vedi `docker-compose.yml`).

---

## Produzione — sequenza deploy

**Playbook dettagliato (17 voci manuali #01–#19):** [docs/GO-LIVE-OPS-PLAYBOOK.md](./docs/GO-LIVE-OPS-PLAYBOOK.md)

1. Crea **Supabase** (EU) + bucket **R2** · copia env da **`vercel-env.template`** su Vercel → playbook **#02–#09**
2. `npm run deploy:check` (con env prod nel terminale o file `.env.production` locale)
3. `DIRECT_URL="postgresql://…:5432/…" npm run db:deploy` → playbook **#05**
4. Deploy progetto su **Vercel** (branch main) → playbook **#01**
5. **DNS** Hostinger → Vercel (A + CNAME www) → playbook **#11**
6. `BASE_URL=https://onizuka.it CRON_SECRET=<secret> npm run passi-mancanti:prod` → playbook **#12–#19**
7. `/admin/go-live` — 0 todo obbligatori · password reali (no seed demo) → **#06, #13, #14**
8. Secrets **GHA** + SMTP + Upstash → playbook **#15–#18**

---

## 1. Obbligatori per produzione

| # | Locale | Prod | Passo | Verifica |
|---|--------|------|--------|----------|
| 1 | ○ | ○ | Repository GitHub aggiornato | Push deploy |
| 2 | ✓ Docker | ○ | Supabase (EU) + bucket **R2** | Console cloud |
| 3 | ✓ | ○ | **`DATABASE_URL`** pooler **6543** | Vercel · `deploy:check` |
| 4 | ✓ | ○ | **`DIRECT_URL`** **5432** | Vercel migrate |
| 5 | ✓ | ○ | **`prisma migrate deploy`** + batch F | `db:deploy` · go-live probe |
| 6 | ○ | ○ | Seed / password reali | `db:seed` poi cambio password |
| 7 | ✓ locale | ○ | **`NEXTAUTH_URL`** + **`NEXTAUTH_SECRET`** | prod: `https://onizuka.it` |
| 8 | ○ | ○ | **`ONIZUKA_PRIMARY_HOST=onizuka.it`** | Vercel |
| 9 | ○ local OK | ○ | Storage **S3/R2** in prod | `/api/health/ready` → `s3` |
| 10 | ✓ vercel.json | ○ | **`CRON_SECRET`** + cron | `smoke:prod` |
| 11 | ○ | ○ | **DNS** + SSL | Hostinger |
| 12 | ✓ | ○ | **Smoke HTTP** prod | `BASE_URL=https://onizuka.it npm run smoke:prod` |
| 13 | ✓ [repo] | ✓ | **`/admin/go-live`** 0 todo | Card passi mancanti |
| 14 | ○ | ○ | Login admin + upload prod | Browser |

### Variabili Vercel

```bash
npm run deploy:check
```

Template: **`vercel-env.template`**.

### Database produzione

```bash
DIRECT_URL="postgresql://…:5432/…" npm run db:deploy
```

### DNS Hostinger

- **A** `@` → Vercel · **CNAME** `www` → `cname.vercel-dns.com` · SSL Vercel

---

## 2. Consigliati subito dopo

| # | Locale | Prod | Passo |
|---|--------|------|--------|
| 15 | ○ | ○ | SMTP |
| 16 | ✓ [repo] | ○ | GHA cron secrets | [.github/workflows/README.md](./.github/workflows/README.md) |
| 17 | ○ | ○ | Upstash |
| 18 | ○ | ○ | Test webhook |
| 19 | ✓ [repo] | ○ | `npm run deploy:verify` |

---

## 3. Opzionali

| # | Passo |
|---|--------|
| 20–30 | n8n, Sheet audit, Meta/LinkedIn, OpenAI, GPU, K8s, staging, marketing Hostinger, Drive parent, PDF partner, integrazioni go-live |

---

## 4. Smoke test

### Locale (fatto)

```bash
npm run db:seed:e2e
npm run dev
npm run local:setup
npm run passi-mancanti:full
npm run passi-mancanti:e2e
```

### Produzione

```bash
npm run deploy:check
npm run passi-mancanti:prod
# oppure dopo deploy:
BASE_URL=https://onizuka.it CRON_SECRET=<secret> npm run passi-mancanti:prod
```

### Manuale post-deploy prod

- [ ] `/walkin` · `/status` · `/login`
- [ ] `/admin` · regia · intelligence · contacts · opportunity-bottlenecks
- [ ] `/admin/chat` · `/admin/ai-runs`
- [ ] Cliente → onboarding + impegni · Flow `[Meeting]`
- [ ] `/admin/activity` · `/admin/reports/service-activations`
- [ ] Cron `Bearer CRON_SECRET`

---

## 5. Cron e env

| Endpoint | Vercel + GHA |
|----------|----------------|
| `/api/cron/notifications` | Sì |
| `/api/cron/webhook-retry` | Sì |
| `/api/cron/reach-sequences` | Sì |
| `/api/cron/audit-sheet-queue` | Solo GHA |
| `/api/cron/dedupe-training` | Solo GHA |

Disabilitare con `0`: `LEAD_FOLLOWUP_CRON`, `INTELLIGENCE_REFRESH_CRON`, `OPPORTUNITY_SLA_CRON`, `MEETING_FOLLOWTHROUGH_CRON`, `NOTIFY_DIGEST_CRON`.

---

## 6. Comandi rapidi

```bash
npm run db:up
npm run db:deploy
npm run db:seed:e2e
npm run passi-mancanti:check
npm run local:setup
npm run passi-mancanti:full
npm run passi-mancanti:e2e
npm run deploy:check
npm run passi-mancanti:prod
npm run build
npm run deploy:verify   # alias di passi-mancanti:prod
npm run smoke:prod
```

---

## 7. Documentazione (cartella `docs/`)

| File | Contenuto |
|------|-----------|
| [docs/README.md](./docs/README.md) | **Indice** di tutta la documentazione |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Deploy Vercel + Supabase + R2 |
| [docs/GO-LIVE-OPS-PLAYBOOK.md](./docs/GO-LIVE-OPS-PLAYBOOK.md) | **Playbook** 17 passi cloud (#01–#19) |
| [docs/GO-LIVE.md](./docs/GO-LIVE.md) | Hub release |
| [docs/PRODUCT-STATUS.md](./docs/PRODUCT-STATUS.md) | Stato codice e archivi |
| [docs/PRESENTAZIONE-ONIZUKA.md](./docs/PRESENTAZIONE-ONIZUKA.md) | Presentazione commerciale |
| [docs/presentazione/slides.html](./docs/presentazione/slides.html) | Slide (stampa / PDF) |
| [docs/ROADMAP-MIGLIORAMENTI.md](./docs/ROADMAP-MIGLIORAMENTI.md) | Roadmap integrata (tutte le proposte) |
| [docs/RUNBOOK-INCIDENTI.md](./docs/RUNBOOK-INCIDENTI.md) | Runbook incidenti |
| [docs/PUNTO-SITUA-DEFINITIVO.md](./docs/PUNTO-SITUA-DEFINITIVO.md) | Architettura Online Station / Onizuka |
| [docs/CURSOR-CHECKLIST-ONIZUKA.md](./docs/CURSOR-CHECKLIST-ONIZUKA.md) | Checklist Cursor §18 |

I file `.md` nella root con titolo «Spostato» sono solo redirect (link vecchi).

**Aggiorna solo PASSI-MANCANTI.md** per la checklist ops.

---

## 8. Roadmap miglioramenti (integrata)

Tutte le proposte (processi, stack, prodotto, qualità) sono tracciate in **[docs/ROADMAP-MIGLIORAMENTI.md](./docs/ROADMAP-MIGLIORAMENTI.md)** con ID `GL-*`, `PR-*`, `ST-*`, `PD-*`, `QA-*`.

| Priorità | Esempi |
|----------|--------|
| Immediato | Playbook go-live, `passi-mancanti:prod`, Upstash |
| Q2 | Runbook incidenti (doc fatto), SLA dashboard, template onboarding |
| Q2–Q3 | Worker automazioni, Sentry, staging |
| Q3+ | PWA portale, 2FA, BI export, inbox Gmail, publish nativo |

---

_Ultimo aggiornamento: `passi-mancanti:full` OK · Jest 227/227 · playbook ops · slide/PDF · roadmap integrata; restano solo azioni nelle console cloud (Supabase, R2, Vercel, DNS, SMTP, GHA)._

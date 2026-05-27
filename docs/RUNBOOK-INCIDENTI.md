# Onizuka — Runbook incidenti

_Proposta roadmap integrata · uso operativo post go-live_

## Contatti rapidi

| Sistema | Dove |
|---------|------|
| App | Vercel → Deployments / Logs |
| DB | Supabase → Logs / Database health |
| Storage | Cloudflare R2 → bucket metrics |
| Cron | Vercel Cron + GitHub Actions runs |
| Email | Gmail / SMTP provider |

---

## 1. App non risponde (5xx / timeout)

1. Vercel → ultimo deploy: rollback se deploy recente fallito.
2. `GET /api/health` — se 200, problema route specifica; se 5xx, env o build.
3. `GET /api/health/ready` — controlla `database`, `storage`, `smtp`.
4. Supabase: progetto paused? limite connessioni pooler?
5. Log Vercel: `DATABASE_URL` errata, `NEXTAUTH_SECRET` mancante.

**Fix comuni:** ripristinare env da `vercel-env.template` · redeploy · `db:deploy` se errore schema.

---

## 2. Database / migrazioni

| Sintomo | Azione |
|---------|--------|
| `relation does not exist` | `DIRECT_URL=… npm run db:deploy` da locale |
| `extension vector` | Supabase SQL: `create extension vector;` |
| Pooler timeout | Usare `DATABASE_URL` 6543, non direct in runtime |
| Migrate bloccata | `prisma migrate resolve` + [GO-LIVE-OPS-PLAYBOOK.md](./GO-LIVE-OPS-PLAYBOOK.md) #05 |

---

## 3. Upload / media rotti

1. `/api/health/ready` → `storage: local` in prod = **errore** (manca R2).
2. Verifica `S3_*` su Vercel, permessi token R2, `S3_PUBLIC_URL`.
3. CORS/CDN: URL media 403 → policy bucket pubblico o signed URL.

---

## 4. Cron non eseguiti

1. `CRON_SECRET` uguale su Vercel e GHA?
2. `curl -H "Authorization: Bearer $CRON_SECRET" https://onizuka.it/api/cron/notifications`
3. Vercel Cron: piano supporta cron? `vercel.json` paths presenti?
4. GHA: workflow `cron-audit-sheet-queue` / `cron-dedupe-training` — secret `ONIZUKA_CRON_*_URL` corretti?
5. Disabilitare job: env `LEAD_FOLLOWUP_CRON=0`, ecc. (vedi PASSI-MANCANTI §5)

---

## 5. Webhook n8n falliti

1. `/admin/webhooks` → deliveries failed
2. `npm run` / cron `webhook-retry` o attesa cron 15 min
3. Verificare firma HMAC: secret subscription = secret n8n
4. Target URL raggiungibile da Vercel (no localhost)

---

## 6. Login / sessioni

1. `NEXTAUTH_URL` deve essere `https://onizuka.it` esatto
2. `ONIZUKA_PRIMARY_HOST=onizuka.it`
3. Upstash: rate limit login eccessivo? → temporaneo disabilita o whitelist IP
4. Cookie: dominio www vs apex — allineare DNS e PRIMARY_HOST

---

## 7. Email non partono

1. `/api/health/ready` → `smtp: false`
2. App password Gmail, `GMAIL_SMTP_FROM` verificato
3. Log invio in Vercel (cercare `smtp-send`)
4. `NOTIFY_DIGEST_CRON=0` se digest non urgente

---

## 8. Performance lenta

1. Supabase: query lente → index, `explain` in Studio
2. Upstash + Redis per rate limit (non obbligatorio ma consigliato)
3. Worker automazioni: coda grande → `AUTOMATION_QUEUE_CRON` o worker dedicato (roadmap)
4. Memoria RAG: batch reindex off-peak (`npm run memory:embeddings`)

---

## Escalation

Documentare in ticket interno: ora, sintomo, ultimo deploy, env cambiati, output `health/ready`, screenshot go-live.

_Roadmap prevenzione: [ROADMAP-MIGLIORAMENTI.md](./ROADMAP-MIGLIORAMENTI.md)_

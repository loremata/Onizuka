# GitHub Actions — cron Onizuka

Secrets da impostare in **Settings → Secrets and variables → Actions** (PASSI-MANCANTI #16).

| Secret | Esempio valore |
|--------|----------------|
| `CRON_SECRET` | Stesso valore di Vercel `CRON_SECRET` |
| `ONIZUKA_CRON_URL` | `https://onizuka.it/api/cron/notifications` |
| `ONIZUKA_CRON_WEBHOOK_RETRY_URL` | `https://onizuka.it/api/cron/webhook-retry` |
| `ONIZUKA_CRON_REACH_URL` | `https://onizuka.it/api/cron/reach-sequences` |
| `ONIZUKA_CRON_AUDIT_SHEET_URL` | `https://onizuka.it/api/cron/audit-sheet-queue` |
| `ONIZUKA_CRON_DEDUPE_URL` | `https://onizuka.it/api/cron/dedupe-training` |

Workflow:

| File | Schedule |
|------|----------|
| `cron-notifications.yml` | Giornaliero |
| `cron-webhook-retry.yml` | Ogni 15 min |
| `cron-reach-sequences.yml` | Giornaliero |
| `cron-audit-sheet-queue.yml` | Ogni 30 min |
| `cron-dedupe-training.yml` | Notturno |
| `migrate-production.yml` | Manuale (`SUPABASE_DIRECT_URL`) |

Vercel copre gli stessi path via `vercel.json` se il progetto è su Vercel Pro.

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
| `cron-notifications.yml` | Solo manuale (`workflow_dispatch`) |
| `cron-webhook-retry.yml` | Solo manuale (`workflow_dispatch`) |
| `cron-reach-sequences.yml` | Solo manuale (`workflow_dispatch`) |
| `cron-audit-sheet-queue.yml` | Solo manuale (`workflow_dispatch`) |
| `cron-dedupe-training.yml` | Solo manuale (`workflow_dispatch`) |
| `migrate-production.yml` | Manuale (`SUPABASE_DIRECT_URL`) |

**I cron schedulati GitHub Actions sono disabilitati**: il progetto è su Vercel Pro
e `vercel.json` copre `/api/cron/notifications`, `/api/cron/webhook-retry` e
`/api/cron/reach-sequences`. I workflow restano lanciabili a mano (`workflow_dispatch`)
come backup: in quel caso imposta i secret nella tabella sopra. Per riattivare lo
schedule, ripristina il blocco `schedule:` nel relativo file.

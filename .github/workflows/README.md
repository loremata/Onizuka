# GitHub Actions — Onizuka

## Cron → sono su Vercel, NON qui
I cron di produzione girano via **`vercel.json`** (Vercel Pro): `notifications`,
`webhook-retry`, `reach-sequences`, `audit-sheet-queue`, `scraping-audit`,
`automation-queue`, `dedupe-training`. **Unica fonte di verità = `vercel.json`.**

I vecchi workflow `cron-*.yml` (backup manuali disabilitati) sono stati **rimossi**
per evitare confusione: c'era una doppia configurazione senza alcun cron realmente
schedulato da GitHub.

## Workflow attivi qui
| File | Cosa fa | Trigger |
|------|---------|---------|
| `ci.yml` | Lint + test + build + e2e | push/PR su main |
| `scraper.yml` | Worker scraping aziende (curl, no limite 5 min) | `repository_dispatch: scrape` (bottone "Avvia scraping" di Onizuka) + `workflow_dispatch` |
| `migrate-production.yml` | `prisma migrate deploy` su prod | manuale (`SUPABASE_DIRECT_URL`) |

Secret per lo scraper: `SCRAPER_DATABASE_URL`, `GOOGLE_PLACES_API_KEY`
(Settings → Secrets and variables → Actions).

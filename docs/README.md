# Documentazione Onizuka

Indice unico. **Checklist operativa (spuntare):** [PASSI-MANCANTI.md](../PASSI-MANCANTI.md) · live **`/admin/go-live`**.

## Deploy e go-live

| Documento | Contenuto |
|-----------|-----------|
| [PASSI-MANCANTI.md](../PASSI-MANCANTI.md) | **Checklist unica** — locale + produzione |
| [DEPLOY.md](./DEPLOY.md) | Vercel + Supabase + R2 + DNS Hostinger |
| [GO-LIVE.md](./GO-LIVE.md) | Hub release, funzioni già in codice |
| [STAGING.md](./STAGING.md) | Ambiente staging dedicato |
| [HOSTINGER-MARKETING.md](./HOSTINGER-MARKETING.md) | Sito vetrina / landing separato |

## Strategia e implementazione

| Documento | Contenuto |
|-----------|-----------|
| [PUNTO-SITUA-DEFINITIVO.md](./PUNTO-SITUA-DEFINITIVO.md) | **Canonico** — Online Station, Onizuka, brand, regole |
| [CURSOR-CHECKLIST-ONIZUKA.md](./CURSOR-CHECKLIST-ONIZUKA.md) | Checklist §18 per Cursor (copiabile) |
| [GAP-VS-PUNTO-SITUA.md](./GAP-VS-PUNTO-SITUA.md) | Codice attuale vs target strategico |

## Prodotto e presentazione

| Documento | Contenuto |
|-----------|-----------|
| [PRESENTAZIONE-ONIZUKA.md](./PRESENTAZIONE-ONIZUKA.md) | **Pitch commerciale** — macro-aree, funzionalità, scenari |
| [GO-LIVE-OPS-PLAYBOOK.md](./GO-LIVE-OPS-PLAYBOOK.md) | Playbook 17 passi produzione (Supabase, R2, …) |
| [ROADMAP-MIGLIORAMENTI.md](./ROADMAP-MIGLIORAMENTI.md) | Roadmap integrata (tutte le proposte) |
| [RUNBOOK-INCIDENTI.md](./RUNBOOK-INCIDENTI.md) | Runbook incidenti post go-live |
| [presentazione/slides.html](./presentazione/slides.html) | Slide · `npm run presentazione:pdf` |
| [ONIZUKA_MASTER_SPEC.md](./ONIZUKA_MASTER_SPEC.md) | Specifica moduli P0 |
| [PRODUCT-STATUS.md](./PRODUCT-STATUS.md) | Stato codice, batch, archivi storici |
| [ONIZUKA-AUDIT-GAP.md](./ONIZUKA-AUDIT-GAP.md) | Audit moduli (sintesi) |

## CI / automazioni

| Documento | Contenuto |
|-----------|-----------|
| [../.github/workflows/README.md](../.github/workflows/README.md) | Secrets GitHub Actions (cron) |

## Comandi CLI (package.json)

| Comando | Uso |
|---------|-----|
| `npm run passi-mancanti:check` | Verifica env + repo |
| `npm run passi-mancanti:full` | Locale: check + smoke + Jest |
| `npm run passi-mancanti:prod` | Produzione: deploy-check + smoke https |
| `npm run passi-mancanti:e2e` | Playwright PASSI-MANCANTI |
| `npm run local:setup` | `.env.local` (CRON + upload dev) |
| `npm run deploy:check` | Solo validazione env |
| `npm run setup:prod` | Bootstrap env da template |

# Onizuka — Roadmap miglioramenti (integrata)

_Tutte le proposte da [PRESENTAZIONE-ONIZUKA.md](./PRESENTAZIONE-ONIZUKA.md) — tracciamento unico._

**Legenda:** `[ ]` da fare · `[~]` in corso · `[x]` fatto

---

## Immediato — pre go-live

| ID | Proposta | Stato | Azione / artefatto |
|----|----------|-------|-------------------|
| GL-01 | Completare ops cloud (17 voci manuali) | [ ] | [GO-LIVE-OPS-PLAYBOOK.md](./GO-LIVE-OPS-PLAYBOOK.md) |
| GL-02 | `passi-mancanti:prod` su onizuka.it | [ ] | `BASE_URL=https://onizuka.it npm run passi-mancanti:prod` |
| GL-03 | Test Jest stabili con DB Docker | [x] | 227/227 test · seed `db:seed:e2e` |
| GL-04 | `passi-mancanti:full` locale | [x] | check + smoke 7/7 + cron 3/3 + Jest upload |
| GL-05 | Upstash Redis in produzione | [ ] | Playbook #17 |
| GL-06 | Presentazione PDF/slide | [x] | `docs/presentazione/slides.html` · `npm run presentazione:pdf` |

---

## Processi e operatività (Q2)

| ID | Proposta | Priorità | Deliverable |
|----|----------|----------|-------------|
| PR-01 | Runbook incidenti | Alta | [RUNBOOK-INCIDENTI.md](./RUNBOOK-INCIDENTI.md) |
| PR-02 | SLA dashboard unificata | Media | Ticket + opportunità + flow in una vista `/admin` |
| PR-03 | Template onboarding per vertical | Media | Preset retail / digital / B2B su `ClientOnboardingItem` |
| PR-04 | Report PDF mensile automatico cliente | Bassa | Cron + template + invio email portale |

---

## Stack e infrastruttura (Q2–Q3)

| ID | Proposta | Priorità | Note implementative |
|----|----------|----------|-------------------|
| ST-01 | Upstash obbligatorio prod | Alta | Env + health ready |
| ST-02 | Worker automazioni dedicato | Media | Decouple `processAutomationFlowQueue` da cron notifiche; K8s/CF Worker |
| ST-03 | Sentry + log strutturati cron/API | Media | `instrumentation.ts` + wrapper route cron |
| ST-04 | Staging Vercel + DB isolato | Media | [STAGING.md](./STAGING.md) · `vercel-env.staging.template` |
| ST-05 | Upgrade Next.js 15 | Bassa | Dopo stabilizzazione ecosystem |

---

## Prodotto — funzionalità aggiuntive (Q3+)

| ID | Proposta | Priorità | Descrizione |
|----|----------|----------|-------------|
| PD-01 | PWA portale cliente + push | Alta | Service worker `/app`, notifiche Web Push |
| PD-02 | 2FA / passkey admin | Alta | NextAuth provider WebAuthn |
| PD-03 | BI export (BigQuery / Metabase) | Media | Export CSV/Parquet finance + CRM |
| PD-04 | Template preventivo per brand | Media | `OpportunityQuote` template da `CommercialService` |
| PD-05 | Inbox Gmail in Action Inbox | Media | OAuth Gmail già presente → unificare in inbox |
| PD-06 | Social publishing nativo | Media | Ridurre dipendenza n8n per publish |
| PD-07 | Multi-workspace / white-label | Bassa | `Workspace` già in schema — UI partner |
| PD-08 | Compliance GDPR DSAR | Bassa | Export/delete dati cliente su richiesta |

---

## Qualità e UX

| ID | Proposta | Priorità | Stato |
|----|----------|----------|-------|
| QA-01 | E2E upload portale stabile | Media | Jest copre pipeline; E2E 10/11 |
| QA-02 | Nav admin raggruppata (dropdown) | Bassa | Ridurre overload nav secondaria |
| QA-03 | E2E bundle `passi-mancanti:e2e` in CI | Media | GHA con Postgres service |

---

## Non in scope

- Prodotto Kelkoo (`bd-ch`)
- Ripristino brand «StationHQ» come prodotto separato
- Compliance audit legale enterprise (salvo richiesta)

---

## Collegamenti

| Documento | Uso |
|-----------|-----|
| [PASSI-MANCANTI.md](../PASSI-MANCANTI.md) | Checklist ops |
| [GO-LIVE-OPS-PLAYBOOK.md](./GO-LIVE-OPS-PLAYBOOK.md) | 17 passi cloud |
| [PRESENTAZIONE-ONIZUKA.md](./PRESENTAZIONE-ONIZUKA.md) | Pitch commerciale |
| [presentazione/slides.html](./presentazione/slides.html) | Slide / PDF |

_Aggiornare gli ID `[x]` quando un item è consegnato in produzione._

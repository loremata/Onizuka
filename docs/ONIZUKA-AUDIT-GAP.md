# Onizuka — Audit completo gap (post-archivio StationHQ / Backup Cursor)

_Rivisione progetto: codice, master spec, documentazione, cron. Maggio 2026._

## Verdetto

| Ambito | Stato |
|--------|--------|
| **ONIZUKA_MASTER_SPEC** (moduli P0) | **Completo** in codice |
| **Port StationHQ / Backup Cursor** | **Completo** |
| **Batch F / G** | **Completo** in codice |
| **Go-live produzione** | **Solo ops** → **[PASSI-MANCANTI.md](./PASSI-MANCANTI.md)** |

**Checklist operativa (unica):** [PASSI-MANCANTI.md](./PASSI-MANCANTI.md) · live: `/admin/go-live`

---

## Moduli master spec → stato reale

| Modulo | Route / evidenza | Stato |
|--------|------------------|--------|
| Core / Command Center | `/admin`, barra comando, priorità + SLA opp. | **Fatto** |
| CRM | lead, clienti, pipeline, opportunità, preventivi, referrers, dedupe | **Fatto** |
| Flow | `/admin/flow`, template `[Meeting]`, calendar sync | **Fatto** |
| Calendar | `/admin/calendar`, ICS, Google Calendar | **Fatto** |
| Finance | `/admin/finance`, SDI stub, Stripe, export | **Fatto** |
| Audit | `/admin/audit`, audit digitale, VAT lookup | **Fatto** |
| Reach | `/admin/reach`, sequenze, tracking | **Fatto** |
| Sales | `/admin/sales`, brand ecosistema | **Fatto** |
| Drive | `/admin/drive`, service account | **Fatto** |
| Memory | `/admin/memory`, RAG, vault, export | **Fatto** |
| Voice | `/admin/voice`, TTS, Telegram | **Fatto** |
| Insights | `/admin/insights`, forecast, revenue at risk | **Fatto** |
| Client Portal | `/app/*`, ticket, upload, onboarding % | **Fatto** |
| Social Pro | `/admin/social`, publish nativo, inbox | **Fatto** |
| Automazioni | regole, coda, webhook n8n, doc cron | **Fatto** |
| Client 360 | onboarding, commitment, chat, AI runs | **Fatto** |

---

## Batch F / G (implementato — riferimento storico)

Vedi [PRODUCT-STATUS.md](./PRODUCT-STATUS.md). Migrazione batch F: `20260620400000_audit_gap_batch_f`.

---

## Cosa NON è un gap di implementazione

| Voce | Dove si configura |
|------|-------------------|
| DNS, Supabase, R2, Vercel env | [PASSI-MANCANTI.md](./PASSI-MANCANTI.md) §1 |
| SMTP, GHA cron, Upstash | §2 |
| Marketing Hostinger, staging, GPU, K8s | §3 |
| Compliance audit legale StationHQ | Fuori scope |
| Prodotto `bd-ch` (Kelkoo) | Altro progetto |

---

## Cron (riferimento)

Dettaglio endpoint e variabili: [PASSI-MANCANTI.md](./PASSI-MANCANTI.md) §5 · `/admin/automations`.

---

## Archivio cartelle

| Cartella | Archiviabile? |
|----------|----------------|
| `Desktop\StationHQ` | **Sì** |
| `Backup Cursor` | **Sì** |
| PDF marketing pre-Onizuka | **Sì** |

Onizuka è l’unica codebase operativa.

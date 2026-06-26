# Checklist Cursor — Onizuka

_Copia operativa da [PUNTO-SITUA-DEFINITIVO.md](./PUNTO-SITUA-DEFINITIVO.md) · stato: [GAP-VS-PUNTO-SITUA.md](./GAP-VS-PUNTO-SITUA.md)_

---

## Obiettivo

Completare **Onizuka** come BOS interno (non pubblico, non SaaS, non vendibile).

**Eliminare da UI e doc funzionale:** StationHQ, SINFONIA, DRAKKAR, OPERA, SKALD, OUVERTURE, MAESTRO.

---

## 18.0 — Regole permanenti

- [x] **Performance**: ogni nuova pagina/loader segue [PERFORMANCE.md](./PERFORMANCE.md) — no seed sul render, query indipendenti in `Promise.all`, niente N+1 (await nei loop)
- [x] UI mostra solo **Onizuka** (no StationHQ in `src/`)
- [x] Brand in `ECOSYSTEM_BRANDS` (8 brand)
- [x] `Client.kind` Privato / Azienda + codice fiscale
- [x] Label UI **Approval Queue** unificata (`/admin/approvals`)
- [x] Stati commerciali prospect su `Lead.commercialProspectStage`

---

## 18.1 — Brand

- [x] Online Station, LabSeven, StudioPop, DoctorLead, Brandity, Sito24Ore, VaultAI, Lorenzo Matarazzo
- [x] Template email proposta per brand (seed `BRAND_PROPOSAL_TEMPLATES`)
- [ ] Template proposta PDF per brand (usa `OpportunityQuote` generico)
- [ ] Funnel per brand (config UI)

---

## 18.2 — Clienti

- [x] Tipo **Privato** (CF) vs **Azienda** (P.IVA)
- [x] Referenti (`ClientContact`)
- [~] Relazione persona ↔ azienda esplicita (referenti su scheda)
- [x] Scheda cliente, asset, servizi attivi

---

## 18.3 — Servizi

- [x] Catalogo servizi esteso (SIM, FWA, gas, TIM Vision, streaming, landing, e-commerce)
- [x] Macro **Cliente Negozio** vs **Cliente Digitale/AI** (filtri + enum)
- [x] TIM Vision, FWA, gas in catalogo

---

## 18.4 — Moduli obbligatori

| # | Modulo | Stato | Route |
|---|--------|-------|-------|
| 1 | Command Center | [x] | `/admin` |
| 2 | CRM | [x] | `/admin/clients` |
| 3 | Pipeline | [x] | `/admin/crm/pipeline` |
| 4 | Audit digitale | [x] | `/admin/audit/digital` |
| 5 | Proposte | [x] | `OpportunityQuote` |
| 6 | Contratti e rinnovi | [x] | retail + renewals |
| 7 | Delivery / task | [x] | `/admin/flow` |
| 8 | Ticket | [x] | portale + admin |
| 9 | Client Portal | [x] | `/app` |
| 10 | Documenti | [x] | `/admin/documents` |
| 11 | Automazioni | [x] | `/admin/automation-rules` |
| 12 | AI Assistant | [x] | Ask + pipeline P.IVA |
| 13 | Knowledge base | [x] | `/admin/memory` |
| 14 | Economics | [x] | `/admin/economics` |
| 15 | Reporting | [x] | insights, reports |
| 16 | Calendario | [x] | `/admin/calendar` |
| 17 | Content / social | [x] | posts, social |
| 18 | Brand e offerte | [x] | `/admin/sales/brands` |
| 19 | Partner | [x] | referrers |
| 20 | Impostazioni | [x] | `/admin/settings` |
| — | **Approval Queue** | [x] | `/admin/approvals` |

---

## 18.5 — Workflow P.IVA (22 step)

| Step | Stato |
|------|-------|
| 1–7 Comando, intent, P.IVA, dedupe, scheda, azienda, macro | [x] `runProspectDigitalAiByVat` |
| 8–13 Audit, scoring, PDF, salvataggio | [x] |
| 14–17 Proposta, brand, email bozza | [~] email in Approval Queue; quote manuale |
| 18–20 Approval, notifica, invio | [x] `PENDING_APPROVAL` + `/admin/approvals` |
| 21–22 Follow-up 7gg, timeline | [x] `LeadFollowup` + activity log |

---

## 18.6 — Comandi AI minimi

| Comando | Stato |
|---------|-------|
| Punto della situazione oggi | [x] → `/admin` |
| Clienti da ricontattare | [x] → dormant |
| Rinnovi in scadenza | [x] → renewals |
| StudioPop senza ads | [x] → cross-sell |
| Fibra TIM senza TIM Vision | [x] → cross-sell |
| Prospect da P.IVA | [x] → pipeline API + Ask |
| Proposta DoctorLead | [~] quote generico |
| Mail follow-up | [x] reach |
| Task cliente | [x] flow |
| Cross-sell / VaultAI | [x] cross-sell + insights |

---

## 18.7 — Cross-sell (10 pattern)

- [x] Tutti in `/admin/crm/cross-sell?q=…`

---

## 18.8 — Reminder commerciali

- [x] Follow-up lead, SLA opp., meeting, finance renewal
- [ ] Proposta non risposta (cron dedicato)

---

## 18.9 — UI

- [x] Nessun nome legacy in nav
- [x] Approval Queue in nav primaria
- [x] Filtri Privato / Azienda / macro in CRM

---

## Deploy dopo pull

```bash
npm run db:deploy
npm run db:seed   # aggiorna catalogo brand/servizi
```

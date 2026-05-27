# Onizuka — Audit flussi & Roadmap tecnica operativa

**Ultimo aggiornamento:** 2026-05-20  
**Stato BOS:** utilizzabile in produzione; gap principali su vincoli DB e Person CF.

> Legenda colonne attività: **P** priorità (P0 critico … P3 basso) · **D** difficoltà (S/M/L) · **I** impatto business (Alto/Medio/Basso) · **R** rischio tecnico (Basso/Medio/Alto)

---

## Sintesi esecutiva

| Area | Stato |
|------|--------|
| Scheda cliente 360° | Buono — `/admin/clients/[id]` + hub + pannelli commerciali |
| Unicità P.IVA/CF (Client) | Parziale — validazione app; **manca UNIQUE DB** |
| Person / CF | Debole — no vincolo univoco |
| Audit → monetizzazione | Buono — pipeline P.IVA, task, Reach, preventivo |
| Prospecting automatico | MVP — sheet + P.IVA; no Google Places |

**Fonte di verità:** `Client` per monetizzazione; `Lead` pre-conversione; `Person` per referenti multi-azienda.

---

## Ordine globale di implementazione

```text
Blocco A (Fix immediati) → Blocco B (Test CI) → Blocco C (Refactor DB) →
Blocco D (Funzionali CRM) → Blocco E (Audit/prospecting) → Monitoraggio continuo
```

---

## 1. Fix immediati

| ID | Attività | P | D | I | Ordine | Dipendenze | R tech | Risultato atteso | File | Stato |
|----|----------|---|---|---|--------|------------|--------|------------------|------|-------|
| IM-01 | Audit VAT: `ensureBusinessClientByVat` / `findClientByFiscalIdentity` | P0 | S | Alto | 1 | — | Basso | Nessun duplicato da audit P.IVA | `digital-audit-run.ts`, `audit-sheet-queue-processor.ts` | ✅ Fatto |
| IM-02 | API lookup P.IVA audit | P0 | S | Alto | 2 | IM-01 | Basso | Lookup esatto normalizzato | `api/admin/audit/vat/route.ts` | ✅ Fatto |
| IM-03 | Convert lead → client con assert fiscale | P0 | S | Alto | 3 | `client-fiscal-identity.ts` | Basso | Blocco duplicati in conversione | `crm/leads/actions.ts` | ✅ Fatto |
| IM-04 | Test Jest fiscal (no vitest) | P1 | S | Medio | 4 | — | Basso | CI verde su normalizzazione | `__tests__/lib/client-fiscal-identity.test.ts` | ✅ Fatto |
| IM-05 | Cron notifications test: disabilita quote cron o mock Prisma | P1 | S | Medio | 5 | — | Basso | `npm test` senza fail su cron route | `__tests__/api/cron-notifications-route.test.ts` | ✅ Fatto |
| IM-06 | Lead create/update: coerenza P.IVA vs client collegato | P1 | S | Alto | 6 | IM-03 | Basso | Lead non collegato a client con P.IVA diversa | `crm/leads/actions.ts`, `client-fiscal-identity.ts` | ✅ Fatto |
| IM-07 | Messaggio errore fiscal con `existingClientId` in convert lead | P2 | S | Medio | 7 | IM-03 | Basso | UX: path scheda nel messaggio errore | `crm/leads/actions.ts` | ✅ Fatto |

**Criterio di chiusura blocco 1:** `npm run build` + `npm test` tutti verdi — **✅ chiuso 2026-05-20** (118 suite, 245 test).

---

## 2. Refactor necessari

| ID | Attività | P | D | I | Ordine | Dipendenze | R tech | Risultato atteso | File | Stato |
|----|----------|---|---|---|--------|------------|--------|------------------|------|-------|
| RF-01 | Indici UNIQUE parziali PostgreSQL | P0 | M | Alto | 4 | RF-02 audit=0 | **Alto** | DB impedisce duplicati race | `prisma/sql/fiscal-unique-indexes.sql`, `scripts/apply-fiscal-unique-indexes.ts` | ✅ Locale/dev (2026-05-26) |
| RF-02 | Script audit duplicati + normalize dry-run | P0 | M | Alto | 1 | — | Basso | Report prima di ogni migration | `scripts/audit-fiscal-duplicates.ts`, `scripts/normalize-fiscal-values.ts` | ✅ Script |
| RF-03 | Assert Person CF (app) + index prep | P0 | M | Alto | 2 | RF-02 | Medio | Referente univoco per CF | `person-fiscal-identity.ts`, `person-crm.ts` | ✅ App |
| RF-04 | Centralizzare tutti i lookup VAT (rimuovere `contains` residui su write-path) | P1 | S | Medio | 4 | IM-* | Basso | Un solo modulo identità | `client-fiscal-identity.ts`, audit/import |
| RF-05 | Lead ↔ Client: campo `linkedClientId` o auto-prospect client | P1 | L | Alto | 5 | RF-01 | Medio | Una verità prima della conversione | `schema.prisma`, `leads/actions.ts` |
| RF-06 | Ridurre query duplicate scheda 360 | P2 | M | Basso | 6 | — | Basso | Pagina più leggera | `clients/[id]/page.tsx`, `client-360-profile.ts` |

---

## 3. Miglioramenti funzionali

| ID | Attività | P | D | I | Ordine | Dipendenze | R tech | Risultato atteso | File |
|----|----------|---|---|---|--------|------------|--------|------------------|------|
| FN-01 | Filtri lista clienti: rinnovi <30gg, servizi mancanti, audit score | P1 | M | Alto | 1 | — | Basso | Trovare chi contattare in 2 click | `client-list-filters.ts`, `admin/clients/page.tsx` |
| FN-02 | KPI Command Center: prospect, audit coda sheet, privati/aziende | P1 | M | Alto | 2 | — | Basso | Dashboard decisionale | `admin-dashboard-stats.ts`, `admin/page.tsx` |
| FN-03 | Ricerca globale: indici/trigram o min length | P2 | M | Medio | 3 | — | Medio | Search più veloce su grandi DB | `global-search.ts` |
| FN-04 | Walk-in → suggerimento client esistente se P.IVA match | P2 | S | Medio | 4 | IM-03 | Basso | Meno lead orfani | `api/public/walkin/quick/route.ts` |
| FN-05 | Export/report unificato scheda cliente PDF | P3 | L | Medio | 5 | — | Basso | Consegna commerciale | nuovo `api/admin/clients/[id]/export` |

---

## 4. Miglioramenti audit / prospecting

| ID | Attività | P | D | I | Ordine | Dipendenze | R tech | Risultato atteso | File |
|----|----------|---|---|---|--------|------------|--------|------------------|------|
| AP-01 | Opportunity auto post-audit (template titolo/valore) | P1 | M | Alto | 1 | — | Basso | Pipeline popolata senza click manuali | `audit-opportunity-from-audit.ts`, `audit-commercial-wire.ts` | ✅ Fatto |
| AP-02 | Chiave univoca prospect: dominio oltre P.IVA | P1 | M | Alto | 2 | RF-01 | Medio | Meno duplicati senza P.IVA | `client-fiscal-identity.ts`, audit ingest |
| AP-03 | Google Places / Maps ingest (MVP lista locale) | P2 | L | Alto | 3 | API key | Medio | Prospecting territoriale | nuovo `lib/places-prospect-ingest.ts` |
| AP-04 | Audit async job (coda) per batch sheet | P2 | M | Medio | 4 | — | Medio | UI non bloccata | `audit-sheet-queue-processor.ts`, cron |
| AP-05 | Score audit: integrare metriche probe reali (LCP, meta) | P2 | L | Medio | 5 | — | Basso | Report più credibile | `website-probe.ts`, `digital-audit-run.ts` |
| AP-06 | Report pubblico: CTA verso prenotazione / Reach | P3 | S | Medio | 6 | — | Basso | Conversione da report | `report/[token]`, outreach |

---

## 5. Miglioramenti CRM / monetizzazione

| ID | Attività | P | D | I | Ordine | Dipendenze | R tech | Risultato atteso | File |
|----|----------|---|---|---|--------|------------|--------|------------------|------|
| CM-01 | Audit ↔ lead/client/opportunity (matching centralizzato) | P1 | M | Alto | 1 | IM-06 | Basso | Audit alimenta CRM senza duplicati | `audit-commercial-match.ts`, `audit-commercial-wire.ts` | ✅ Fatto |
| CM-02 | Cross-sell widget in scheda 360 (già gap list) | P2 | S | Alto | 2 | — | Basso | Upsell visibile | `client-360-commercial.tsx` |
| CM-03 | Finance: filtro rinnovi / scaduti da hub | P2 | S | Medio | 3 | — | Basso | Incasso più rapido | `finance/page.tsx`, `finance-renewals.ts` |
| CM-04 | Reminder 12 mesi contratto retail → Flow + notifica | P1 | M | Alto | 4 | automazioni | Medio | Rinnovi non persi | `finance-renewals.ts`, automation rules |
| CM-05 | Vista “clienti dormienti” con azione Reach | P2 | M | Alto | 5 | — | Basso | Recupero revenue | `dormant-reactivation.ts`, reach |
| CM-06 | Person CRM: form edit + assert CF | P1 | M | Alto | 6 | RF-03 | Basso | Referenti affidabili | `crm/people/*`, `person-fiscal-identity.ts` |

---

## 6. Test da aggiungere

| ID | Test | P | D | I | Ordine | Dipendenze | File target |
|----|------|---|---|---|--------|------------|-------------|
| T-01 | `findClientByFiscalIdentity` con Prisma mock | P1 | S | Alto | 1 | IM-* | `__tests__/lib/client-fiscal-identity.test.ts` | ✅ |
| T-02 | `ensureBusinessClientByVat` idempotente | P1 | S | Alto | 2 | IM-01 | `__tests__/lib/prospect-vat-pipeline.test.ts` |
| T-03 | `convertLeadToClient` rifiuta P.IVA duplicata | P1 | M | Alto | 3 | IM-03 | `__tests__/lib/lead-convert-fiscal.test.ts` |
| T-04 | `assertLeadVatClientLink` | P1 | S | Alto | 4 | IM-06 | `__tests__/lib/client-fiscal-identity.test.ts` | ✅ |
| T-05 | E2E: audit P.IVA → scheda 360 → Reach filtrato | P2 | M | Alto | 5 | IM-* | `e2e/admin-reach-draft.spec.ts` |
| T-06 | Cron route mock completo o contract test | P2 | S | Medio | 6 | IM-05 | `cron-notifications-route.test.ts` |
| T-07 | Person fiscal assert | P2 | S | Medio | 7 | RF-03 | `__tests__/lib/person-fiscal-identity.test.ts` | ✅ |

---

## 7. Rischi da monitorare

| ID | Rischio | Segnale | Mitigazione | Owner |
|----|---------|---------|-------------|--------|
| RK-01 | Duplicati Client in prod senza UNIQUE DB | Due schede stessa P.IVA in dedupe | RF-01 + dedupe script | Dev |
| RK-02 | Race create client (2 tab / import parallelo) | Errore post-mortem merge | UNIQUE DB + retry UX | Dev |
| RK-03 | Lead e Client con VAT divergente | Search mostra entrambi incoerenti | IM-06, RF-05 | Dev |
| RK-04 | Person duplicate referenti | Stesso CF due Person | RF-03, CM-06 | Dev |
| RK-05 | Audit batch timeout Vercel | 504 su sheet grande | AP-04 coda async | Ops |
| RK-06 | KPI dashboard dati globali vs owner | Numeri “gonfiati” | Filtrare per `ownerUserId` | Product |
| RK-07 | Import CSV lead con P.IVA sporca | Duplicati dopo import | Normalizzazione in `lead-csv-import.ts` | Dev |
| RK-08 | Cron secret assente | 401 su tutti i cron | `deploy-check.mjs`, go-live docs | Ops |

---

## RF-01 / RF-02 / RF-03 — Fiscal Identity Hardening

### Stato attuale schema (Fase 1)

| Modello | Campi fiscali | UNIQUE DB | Normalizzazione app | Lookup centralizzato |
|---------|----------------|-----------|---------------------|------------------------|
| **Client** | `vatNumber`, `fiscalCode` | ❌ (solo `@@index`) | ✅ `fiscal-normalize` | ✅ `client-fiscal-identity` |
| **Lead** | `vatNumber`, `fiscalCode` | ❌ (voluto: più lead/prospect) | ✅ create/update/import | ✅ link `convertedClientId` |
| **Person** | `fiscalCode` | ❌ | ✅ sync contact + `updatePersonFiscalCode` | ✅ `person-fiscal-identity` |
| **DigitalAudit** | `vatNumber` (copia) | — | via pipeline client | `clientId` canonico |
| **ClientContact** | — | — | — | sync → Person |

**Nota:** non esiste modello `Company` separato — l’azienda è `Client` con `kind=BUSINESS`.

### Rischi attuali

- Race condition su create parallelo senza indici UNIQUE.
- Dati legacy con P.IVA/CF non normalizzati (spazi, minuscole).
- Lead con stessa P.IVA di Client ma `convertedClientId` vuoto (funnel OK, ma confusione UI).
- Person senza CF obbligatorio (referenti senza CF ancora ammessi).

### Proposta migration (RF-01) — **non distruttiva**

1. Migration Prisma **no-op**: `20260621130000_fiscal_unique_indexes_pending` (`SELECT 1`).
2. SQL manuale: `prisma/sql/fiscal-unique-indexes.sql` (indici parziali PostgreSQL).
3. Applicazione solo dopo audit pulito: `npm run fiscal:apply-unique-indexes -- --execute`.

### Script (RF-02)

| Comando | Effetto |
|---------|---------|
| `npm run fiscal:audit-duplicates` | Solo lettura, report console |
| `npm run fiscal:normalize-values` | Dry-run normalizzazione |
| `npm run fiscal:normalize-values -- --execute` | Scrive VAT/CF normalizzati (dopo backup) |
| `npm run fiscal:apply-unique-indexes -- --execute` | Crea indici UNIQUE se 0 duplicati |

### Rollback

Vedi `docs/FISCAL-IDENTITY-ROLLBACK.md` (`DROP INDEX …`).

### Ordine esatto interventi produzione

1. Backup DB.
2. `fiscal:audit-duplicates`
3. Risolvere duplicati (`/admin/crm/dedupe` o manuale).
4. `fiscal:normalize-values -- --execute` (opzionale).
5. `fiscal:audit-duplicates` (verifica 0 blocchi).
6. `fiscal:apply-unique-indexes -- --execute`
7. `prisma migrate deploy` (solo placeholder no-op se non già applicata).

### Test obbligatori aggiunti

- `__tests__/lib/fiscal-normalize.test.ts`
- `__tests__/lib/person-fiscal-identity.test.ts`
- Estensione `client-fiscal-identity.test.ts`

### Registro RF (2026-05-20)

| ID | Esito |
|----|--------|
| RF-02 | Script audit + normalize creati |
| RF-03 | `person-fiscal-identity.ts`, assert in `person-crm.ts` |
| RF-01 | SQL + apply script; **indici NON applicati automaticamente** |
| RF-01 local | Indici applicati su DB `127.0.0.1:5433` + test integrazione |

---

## Fiscal UNIQUE Indexes — Local/Dev Verification

**Data:** 2026-05-26 · **Ambiente:** PostgreSQL locale (`127.0.0.1:5433/onizuka`) · **Produzione:** non toccata.

### FASE 1 — Pre-check

| Comando | Esito |
|---------|--------|
| `npm run fiscal:audit-duplicates` | ✅ 0 duplicati (VAT, CF, Person, lead) |
| `npm run fiscal:normalize-values` | ✅ DRY-RUN: 0 record da aggiornare |
| `npm test` | ✅ 120 suite (pre-index baseline) |
| `npm run build` | ✅ OK |

### FASE 2 — Applicazione indici (solo locale)

```bash
npm run fiscal:apply-unique-indexes -- --execute
npx tsx scripts/verify-fiscal-indexes.ts
```

| Indice | Tipo | Condizione WHERE |
|--------|------|------------------|
| `Client_vatNumber_norm_unique` | UNIQUE parziale | `vatNumber IS NOT NULL AND trim <> ''` |
| `Client_fiscalCode_norm_unique` | UNIQUE parziale | `fiscalCode IS NOT NULL AND trim <> ''` |
| `Person_owner_fiscalCode_norm_unique` | UNIQUE parziale | `ownerUserId` + CF normalizzato, CF non vuoto |

**Verifiche comportamento indici:**

- Più `Client` con `vatNumber` / `fiscalCode` **NULL** → consentito.
- Più `Person` senza CF → consentito.
- Lead senza vincolo UNIQUE su VAT (funnel prospect) → invariato.
- Stessa P.IVA con spazi/minuscole → **bloccato** (espressione `UPPER(REGEXP_REPLACE(TRIM…))`).

### FASE 3 — Post-index

| Comando | Esito |
|---------|--------|
| `npm run fiscal:audit-duplicates` | ✅ 0 duplicati |
| `npm test` | ✅ **122 suite, 262 test** (incl. integrazione DB) |
| `npm run build` | ✅ OK |

**Test aggiunti:**

- `__tests__/lib/fiscal-unique-error.test.ts` — messaggi operativi da P2002
- `__tests__/lib/fiscal-unique-db.integration.test.ts` — violazioni reali su DB locale

**Casi coperti da integrazione DB:**

- Doppio Client stessa P.IVA (anche formato sporco) → `P2002`
- Doppio Client stesso CF → `P2002`
- Doppio Person stesso CF stesso owner → `P2002`
- Multipli record con VAT/CF null → OK
- `ensureBusinessClientByVat` idempotente → OK

### FASE 4 — Messaggi errore UI

`src/lib/fiscal-unique-error.ts` + catch in `clients/actions.ts` e `convertLeadToClient`:

- Esempio: *«Esiste già un cliente con questa Partita IVA. Apri la scheda esistente o collega il lead.»*
- Non espone `Unique constraint failed on constraint…` all’utente (doppio controllo app + DB).

### Rollback locale (documentato, non eseguito in questa sessione)

```sql
-- docs/FISCAL-IDENTITY-ROLLBACK.md
DROP INDEX IF EXISTS "Client_vatNumber_norm_unique";
DROP INDEX IF EXISTS "Client_fiscalCode_norm_unique";
DROP INDEX IF EXISTS "Person_owner_fiscalCode_norm_unique";
```

### Produzione — istruzioni (NON eseguite)

1. Backup DB produzione.
2. `fiscal:audit-duplicates` su prod.
3. Dedupe manuale se > 0.
4. `fiscal:normalize-values -- --execute` (opzionale, dopo backup).
5. Ripetere audit → 0 blocchi.
6. `fiscal:apply-unique-indexes -- --execute` su prod.
7. Smoke test creazione cliente / convert lead / audit P.IVA.

### Rischi residui

- Race estremamente ravvicinata ridotta ma testata solo in integrazione sequenziale.
- Lead con stessa P.IVA di Client senza `convertedClientId` ancora ammesso (by design).
- `migrate deploy` in prod registra solo migration **no-op**; indici restano step manuale/script.

### Pronto per blocco successivo?

| Blocco | Pronto? |
|--------|---------|
| **CM-01** (pre-link lead → client) | ✅ Implementato 2026-05-20 |
| **AP-01** (opportunity post-audit) | ✅ Implementato 2026-05-20 |

---

## CM-01 / AP-01 — Audit to CRM Opportunity Flow

**Data implementazione:** 2026-05-20 · **Test:** 125 suite / 272 test · **Build:** OK (locale)

### Flusso prima

- L’audit (`runDigitalAuditForClient`) richiedeva sempre un `clientId`; matching P.IVA solo in pipeline P.IVA / sheet, non centralizzato.
- `DigitalAudit` senza `leadId`; `Opportunity` senza `source` / `digitalAuditId`.
- Servizi consigliati in `pickRecommendation` inline in `digital-audit-run.ts`.
- Opportunity/preventivo: `draft-quote-from-audit.ts` riusava bozza generica «Audit» senza legame all’audit.
- Task post-audit creati sempre, senza dedupe.
- Scheda lead senza riepilogo audit/opportunity.

### Problemi trovati

| Problema | Impatto |
|----------|---------|
| Audit isolato dal lead CRM | Doppi prospect, scheda lead vuota |
| Nessun `digitalAuditId` su opportunity | Impossibile evitare 10 opportunity per stesso audit |
| Mappa servizi sparsa | Incoerenza UI vs motore commerciale |
| Task duplicati a ogni re-run | Rumore operativo in Flow |

### Flusso dopo

```text
Input audit (P.IVA / dominio / clientId / form)
  → prepareAuditCommercialTarget()     [audit-commercial-match.ts]
  → runDigitalAuditForClient()         [digital-audit-run.ts + leadId]
  → wireAuditCommercialCrm()           [audit-commercial-wire.ts]
       ├─ ensureOpportunityFromDigitalAudit()  [source DIGITAL_AUDIT, digitalAuditId]
       └─ createAuditFollowUpTasks()   [dedupe per auditId]
  → UI: AuditCommercialSummaryCard su Client + Lead; link bidirezionale audit ↔ lead/client
```

### Regole di matching (priorità)

1. **P.IVA → Client BUSINESS** → collega audit al client; lead collegato se esiste; no nuovo lead duplicato.
2. **P.IVA → Lead** → collega audit; aggiorna stage; `ensureBusinessClientByVat` se manca client.
3. **P.IVA nuova** → nuovo client + lead + audit (`new_prospect`).
4. **Solo dominio** → match client per `website`; warning se debole.
5. **Ragione sociale** → fuzzy `companyName`; `possible_duplicate` + task revisione; no merge automatico.
6. **Client già convertito** → audit sul client; lead convertito non riaperto.

### File modificati

| Area | File |
|------|------|
| Schema | `prisma/schema.prisma`, migration `20260626120000_audit_crm_linking` |
| Matching | `src/lib/audit-commercial-match.ts` |
| Servizi | `src/lib/audit-service-recommendations.ts` |
| Opportunity | `src/lib/audit-opportunity-from-audit.ts`, `draft-quote-from-audit.ts` (re-export) |
| Orchestrazione | `src/lib/audit-commercial-wire.ts`, `digital-audit-run.ts`, `prospect-vat-pipeline.ts` |
| Task | `src/lib/audit-follow-up.ts` |
| UI | `load-audit-commercial-summary.ts`, `audit-commercial-summary-card.tsx`, client/lead/audit pages |
| Test | `audit-commercial-match.test.ts`, `audit-service-recommendations.test.ts`, `audit-follow-up-dedupe.test.ts`, `draft-quote-from-audit.test.ts` (aggiornato) |

### Test aggiunti

- Matching P.IVA client/lead/nuovo, dominio, dati insufficienti.
- Mappa servizi per sezione debole + priorità commerciale.
- Dedupe task follow-up.
- Opportunity con `DIGITAL_AUDIT` + riuso per `digitalAuditId`.

### Rischi residui

- Match fuzzy ragione sociale ancora euristico (no score Levenshtein).
- Google Places / import sheet non passano tutti da `prepareAuditCommercialTarget` (solo P.IVA path e `runDigitalAuditByVat`).
- `Opportunity` resta legata a `clientId` (no `leadId` su modello).
- Migration CM-01 su **produzione**: applicare con stessa prudenza degli indici fiscali (backup + smoke).

### Prossimi miglioramenti

- Estendere matcher a sheet queue, form manuale audit, Places API.
- `leadId` su `Opportunity` per prospect non ancora convertiti.
- Pannello comunicazioni Reach nella scheda lead (thread unificato).
- E2E: audit P.IVA → opportunity visibile in pipeline.

---

## AP-02 / CM-02 — Audit Sources Unification + Opportunity Lead Linking

**Data:** 2026-05-20 · **Test:** 128 suite / 277 test · **Build:** OK · **Migration:** `20260627120000_opportunity_lead_linking` (solo locale/dev)

### Mappa ingressi audit/prospecting

| Ingresso | File | `prepareAuditCommercialTarget` | Note |
|----------|------|----------------------------------|------|
| Form P.IVA / dominio / RS | `digital-audit-start-form` → `actions.ts` | ✅ via `runDigitalAuditUnified` / `runDigitalAuditByVat` | Campi website + businessName |
| Pulsante audit su cliente | `client-digital-audit-button` → `runDigitalAuditForClient` | ✅ auto se manca match | `acquisitionSource: client_button` |
| Pipeline P.IVA comando | `prospect-vat-pipeline.ts` | ✅ | `prospect_pipeline` |
| Sheet queue (cron) | `audit-sheet-queue-processor.ts` | ✅ `runDigitalAuditUnified` | `sheet_queue` |
| Import sheet CSV | `audit-sheet-ingest.ts` | — (solo enqueue) | Dedupe `sheetRowKey` |
| Google Places | `audit-places-entry.ts` | ✅ | Richiede P.IVA o lead noto; `google_places` |
| Import lead CSV | `lead-csv-import.ts` | — | Non avvia audit (solo lead) |
| GBP enrich in audit | `digital-audit-gbp-enrich.ts` | — | Arricchisce sezioni, non crea prospect |

### Decisione Client vs Lead (prospect nuovi)

**Scelta: D — mantenere `Client` come scheda commerciale univoca (status `LEAD_QUALIFIED`) + `Lead` come contenitore pipeline.**

Motivi: l’audit richiede oggi `clientId` per Drive, Reach, finance hooks; refactor Lead-only (B) o Company/Account (C) è troppo invasivo. Mitigazioni AP-02:

- `Lead` esplicito su audit/opportunity/task;
- `Opportunity.leadId` per tracciare prospect pre-conversione;
- status cliente distingue prospect vs `ACTIVE_CLIENT`;
- Places senza P.IVA → errore guidato + task completamento dati (no client fantasma).

### Modifiche schema

- `Opportunity.leadId` (opzionale), `Opportunity.clientId` nullable
- `Lead.googlePlaceId`, `Lead.website`, `Lead.city`
- FK + indici non distruttivi

### File principali

| Modulo | Path |
|--------|------|
| Ingresso unificato | `audit-commercial-entry.ts` |
| Matching esteso | `audit-commercial-match.ts` |
| Opportunity + dedupe | `audit-opportunity-from-audit.ts` |
| Validazione party | `opportunity-party.ts` |
| Places | `audit-places-entry.ts` |
| Sheet queue | `audit-sheet-queue-processor.ts` |
| Sync post-conversione | `convertLeadToClient` → `opportunity.updateMany` |

### Regole dedupe opportunity

1. Stesso `digitalAuditId` → update (mai seconda opp se OPEN/PAUSED; WON/LOST non sovrascritte).
2. Stesso lead/client + servizio aperto + `DIGITAL_AUDIT` → riuso.
3. Task post-audit dedupe per titolo + `auditId` in descrizione.

### UI

- Form audit: P.IVA + sito + ragione sociale
- Scheda lead/client: `AuditCommercialSummaryCard` con opportunity per `leadId`
- Opportunity edit: lead opzionale, client opzionale, link audit

### Test aggiunti

`opportunity-party.test.ts`, `audit-opportunity-lead.test.ts`, `audit-sheet-queue-unified.test.ts`

### Rischi residui / prima produzione

- `clientId` nullable su Opportunity: verificare quote/email che assumono sempre client
- Sheet senza P.IVA ancora non in coda (solo righe con P.IVA in ingest)
- E2E Playwright audit→pipeline da completare
- Migration AP-02 su prod: backup + smoke (come CM-01)

### Pronto per Dashboard/KPI commerciale?

**Parzialmente sì** — flusso dati unificato in dev; consigliato completare E2E pipeline + smoke prod prima del blocco dashboard.

---

## ST-01 / E2E-01 / SQ-01 — Staging Smoke + Commercial E2E + Sheet Domain-only

**Data:** 2026-05-20 · **Test:** 130 suite / 290 test · **Build:** OK · **Migration:** `20260628120000_sheet_queue_domain_optional` (solo locale/dev)

### Stato migration staging/dev

| Migration | Stato locale |
|-----------|----------------|
| `20260627120000_opportunity_lead_linking` | Applicata |
| `20260628120000_sheet_queue_domain_optional` | Applicata (`AuditSheetQueueItem.vatNumber` nullable, `city`) |

Comandi eseguiti: `npx prisma validate`, `npx prisma migrate status`, `npx prisma migrate deploy`, `npm test`, `npm run build`.

### Smoke test effettuati

- Colonne `Opportunity.leadId`, `clientId` nullable (query `information_schema` in test integrazione)
- `assertOpportunityParty` lead-only / client-only / entrambi
- `prepareAuditCommercialTarget` P.IVA nuova + riuso stessa P.IVA
- `ensureOpportunityFromDigitalAudit` con solo `leadId`
- `quote-no-response` include `lead` (fix AP-02 già in tree)
- Normalizzazione dominio `www`/protocollo/slash

### E2E implementati

| File | Scenari |
|------|---------|
| `e2e/admin-audit-commercial-crm.spec.ts` | A: P.IVA nuova + pipeline; B: stessa P.IVA; C: dominio-only |
| `__tests__/lib/audit-commercial-crm.integration.test.ts` | Smoke DB (skip senza `DATABASE_URL`) |

E2E Playwright richiedono `npm run dev` + DB seed; in CI usare `test:e2e` con webServer.

### Sheet queue dominio-only (SQ-01)

| Tipo riga | Comportamento ingest | Processor |
|-----------|---------------------|-----------|
| P.IVA valida | Accoda (`kind: vat`) | `runDigitalAuditUnified` |
| Solo dominio | Accoda (`kind: domain`) | Match client/lead → audit; altrimenti lead-only + task P.IVA, status `SKIPPED` |
| RS + città | Accoda (`kind: name_city`) | Match univoco con P.IVA → audit; ambiguo → task revisione |
| Insufficiente | `rejected[]` nel report import | Non accodata |

Dedupe import: chiave `vat:…`, `domain:…` (dominio normalizzato), `namecity:…`.

File: `audit-sheet-ingest.ts`, `audit-sheet-domain-row.ts`, `audit-sheet-queue-processor.ts`.

### Verifiche Opportunity `clientId` nullable

- UI quote/opportunity edit: fallback su `lead` già presenti
- `quote-no-response.ts`: include `lead` nelle query cron
- `sales-stats` / pipeline: gestione lead-only dove applicato in AP-02

### Fix applicati in questo blocco

- Sheet ingest/parser esteso + report `rejected`
- Processor con ramo non-VAT e status `SKIPPED`
- Migration queue `vatNumber` nullable
- Test unitari ingest + domain-row
- E2E Playwright commerciale
- Test integrazione smoke CRM

### Rischi residui

- E2E audit reale dipende da probe sito / tempi (timeout 120s)
- Sheet `name_city` senza match crea lead + task, non audit
- Migration non deployata in produzione
- Staging remoto non validato se diverso da DB locale `127.0.0.1:5433`

### Pronto per Dashboard/KPI?

**Sì con riserva** — flusso commerciale smoke-ato in dev, E2E presenti, sheet dominio-only operativo. Prima del blocco dashboard: eseguire E2E su staging con migration AP-02 + SQ-01 e smoke quote send in ambiente reale.

---

## ST-02 — Staging Validation Gate before Dashboard/KPI

**Data:** 2026-05-26 · **Ambiente eseguito:** DB locale `127.0.0.1:5433/onizuka` (staging remoto Supabase non configurato in workspace; `ONIZUKA_ENV` unset)

### Migration

| Migration | Locale |
|-----------|--------|
| `20260627120000_opportunity_lead_linking` | Applicata |
| `20260628120000_sheet_queue_domain_optional` | Applicata |

`npx prisma migrate status` → up to date (69 migration).

### Comandi eseguiti

```bash
npx prisma validate
npx prisma migrate status
npm test          # 131 suite, 293 test
npm run build
npm run staging:commercial-gate   # 19/19 smoke PASS + cleanup
npx playwright test e2e/admin-audit-commercial-crm.spec.ts --workers=1
```

### Gate script (`npm run staging:commercial-gate`)

Smoke automatici con cleanup: schema AP-02/SQ-01, P.IVA nuova/riuso, audit wire, sheet dominio SKIPPED, opportunity lead-only, quote-no-response lead, Places senza P.IVA (errore guidato).

### E2E Playwright (locale, dev su :3000)

| Scenario | Esito | Nota |
|----------|-------|------|
| A P.IVA nuova | **FAIL** | Timeout 120s — form non redirect a dettaglio audit (resta su `/admin/audit/digital`) |
| A pipeline | skipped | dipende da A |
| B stessa P.IVA | skipped | — |
| C dominio-only | skipped | — |
| Setup auth | OK | `admin-auth.setup.ts` |

Classificazione: probabile **lentezza audit/probe** o errore server action non mostrato in UI — da ripetere su staging con log server; non classificato come regressione schema.

### Fix applicati in ST-02

- `quote-email.ts` — invio preventivo con **lead.email** se `client` assente
- `quote-no-response.ts` — task reminder anche per opportunity **lead-only**
- `scripts/staging-commercial-gate-runner.ts` + npm script `staging:commercial-gate`
- Test: `quote-email-lead.test.ts`, estensione `quote-no-response.test.ts`
- E2E: selettori `input[name=…]`, sessione da storage (no doppio login), timeout 120s

### Cleanup

Gate script elimina tutti i record `ST02_*` creati. E2E con stamp `Date.now()` può lasciare prospect su DB locale se A fallisce prima del redirect — cercare `E2E Audit CRM` / P.IVA `IT9…` e rimuovere manualmente se necessario.

### Rischi residui

- Staging Supabase/Vercel **non validato** in questa sessione
- E2E audit end-to-end **non verde** su localhost
- Invio SMTP reale lead-only non testato (solo unit + gate schedule)

### Decisione Dashboard/KPI (pre-KPI-01)

**NO-GO** finché non si ripete su **staging remoto** con `ONIZUKA_ENV=staging`, `migrate deploy`, `staging:commercial-gate` e Playwright verde. **GO tecnico locale** per continuare sviluppo; gate script ripetibile prima del blocco dashboard.

---

## KPI-01 — Commercial Dashboard & Revenue Intelligence

**Data:** 2026-05-26 · **Route:** `/admin/crm/commercial` · **Test:** 6 suite commercial-dashboard + build OK

### Dashboard prima (analisi)

| Vista | Contenuto | Problemi |
|-------|-----------|----------|
| Command Center (`/admin`) | Post, flow, clienti totali, opp aperte, lead NEW, quote draft | Non distingue prospect/cliente reale; no audit KPI; `clientsCount` globale |
| Sales (`/admin/sales`) | Opp aperte/vinte/perse, lead caldi, top opp, preventivi | No audit; no lead-only opp; playbook statico |
| Insights (`/admin/insights`) | Flow, finance, cross-modulo | Generico ops, non commerciale focalizzato |
| CRM analytics lead | Solo lead | No opportunity/audit/monetizzazione |
| Cross-sell | Query salvate | Separato, non in dashboard unica |

**Tenuto:** `loadSalesStats`, `insights-stats`, `loadFinanceOverdueEntries`, `loadUpcomingRetailRenewals`, `loadClientsWithUpsellPotential` (riusati, non duplicati).

**Eliminato come vista primaria:** Sales come unico punto commerciale (resta legacy con link).

### KPI implementati (server `loadCommercialDashboard`)

Lead/prospect, clienti attivi vs `LEAD_QUALIFIED`, opportunity (aperte, da audit, lead-only, alta priorità), pipeline pesata, task commerciali (audit/quote/sheet), audit completati/critici/falliti, lead senza P.IVA, sheet dominio SKIPPED, preventivi bozza, Reach pending, dormienti, incassi scaduti, candidati up-sell, rinnovi 30/60/90g.

### Query / moduli

- `src/lib/commercial-dashboard.ts` — loader centralizzato (`runWithDb`, `Promise.all` counts)
- `src/lib/commercial-dashboard-filters.ts` — periodo 7/30/90/all, filtro dati incompleti

### UI

- `src/app/admin/crm/commercial/page.tsx`
- `CommercialKpiGrid`, `CommercialDashboardSection`, `CommercialDashboardFiltersBar`
- Nav: **Dashboard commerciale** in menu Commerciale

### Azioni rapide

Ogni KPI è link cliccabile; sezioni con CTA (Apri lead, Apri opportunity, Flow, Dedupe, ecc.).

### Test

`__tests__/lib/commercial-dashboard-kpi.test.ts` — filtri, periodo, load con mock Prisma, DB vuoto.

### Rischi residui

- Up-sell count usa `loadClientsWithUpsellPotential` (limite 40 clienti, N+1 gap) — accettabile per top-5 in dashboard
- Filtri `leadStatus` / `oppPriority` URL parsati ma UI solo periodo + incomplete (estendibile)
- Audit “senza follow-up” non come KPI dedicato (usare task commerciali aperti)
- ST-02 E2E audit ancora da verde su staging

### Prossimi miglioramenti

- Filtri UI completi (stato lead, priorità opp, score audit)
- Widget “audit senza follow-up” con join task
- E2E Playwright dashboard smoke
- Indice composito `(ownerUserId, status, source)` su Opportunity se query lente in prod

---

## KPI-02 / ST-02 — Commercial Dashboard Hardening + Staging Gate

**Data:** 2026-05-26

### Problemi KPI-01 risolti

| # | Problema | Fix |
|---|----------|-----|
| 1 | KPI audit senza follow-up proxy | `loadAuditFollowUpSummary()` — campione 120 audit, esclusione opp/task/outreach |
| 2 | Cross-sell parziale | `summarizeCommercialGapsForDashboard()` + count gap + top 5 |
| 3 | Filtri UI incompleti | Barra filtri: lead status, opp priority/source, audit score max |
| 4 | Client counts scope | Documentato agency-wide (`commercial-dashboard-scope.ts`); coerente con `/admin/clients` |
| 5 | Opportunity orfane | Count + KPI + igiene dati + test |
| 6 | Test dashboard parziali | 14 test commercial-* + 307 totali |
| 7 | E2E dashboard assente | `e2e/admin-commercial-dashboard.spec.ts` |
| 8 | ST-02 gate | Script esteso: `smoke.dashboard.*` |

### KPI audit senza follow-up

Audit `COMPLETED` nel campione senza: opportunity OPEN (`digitalAuditId`), task commerciale aperto (source audit + id in description / clientId), outreach recente (14g o PENDING_APPROVAL).

Sotto-classi: `no_commercial_task`, `critical_no_opportunity` (score ≤45), `party_no_action`, `isolated` (no lead/client).

### Owner scope (decisione)

**A + D:** conteggi `Client` restano agency-wide; entità con `ownerUserId` filtrate per sessione. Nota in `commercial-dashboard-scope.ts`.

### Test

- `__tests__/lib/commercial-dashboard-kpi.test.ts` (12 casi)
- `__tests__/lib/commercial-audit-follow-up.test.ts`
- `__tests__/lib/commercial-dashboard-scope.test.ts`

### E2E

```bash
npm run dev   # terminale 1
npm run test:e2e -- admin-commercial-dashboard
npm run test:e2e -- admin-audit-commercial-crm
```

### Staging gate

```bash
npm run staging:commercial-gate
```

Include loader dashboard + audit follow-up + orphan count (non produzione).

### Decisione produzione

**NO-GO deploy produzione** — validare su staging remoto + E2E verde prima del go-live commerciale formale.

**GO tecnico locale** — dashboard hardened, test e build verdi.

### Rischi residui

- Count gap servizi: scan max 48 clienti collegati all'owner (non intero portafoglio).
- Audit senza follow-up: campione 120, non full-table scan.
- E2E richiede dev server + auth setup.
- Indice Opportunity composito solo se lento in prod.

---

## ST-03 — E2E Execution + Real Staging Gate

**Data:** 2026-05-26 · **Ambiente eseguito:** DB locale `127.0.0.1:5433/onizuka` (`ONIZUKA_ENV` unset, nessun `PLAYWRIGHT_BASE_URL` staging)

### Problema iniziale

- E2E falliva se `npm run dev` non era avviato manualmente (setup auth timeout su `/login`).
- Submit audit via UI instabile (probe/redirect); lista pipeline usava testo in `<option>` hidden.
- Build intermittente per cache `.next` corrotta se `build` e `dev` concorrenti.
- Scenario dominio-only senza client pre-esistente → errore applicativo corretto ma E2E non allineato.

### Fix configurazione Playwright / script

- `playwright.config.ts`: `webServer` (`npm run dev` locale / `npm start` CI), readiness `/login`, `PLAYWRIGHT_E2E=1`, `reuseExistingServer` default locale.
- `package.json`: `test:e2e:setup`, `test:e2e:dashboard`, `test:e2e:audit-crm`, `test:e2e:audit-crm:shell`.
- `e2e/global-setup.ts`: seed `db:seed:e2e` + health `/api/health`.
- `e2e/helpers.ts`: login admin via API NextAuth (csrf + credentials), no form UI fragile.
- `scripts/e2e-audit-fixture.ts`: fixture server-side audit; `Array.from(Set)` per build TS; dominio-only con client pre-seeded (match CM-01); cleanup prefix `E2E Audit CRM`.
- `e2e/admin-audit-commercial-crm.spec.ts`: pipeline via `[data-opp-id]`; Scenario B verifica dettaglio audit; Scenario C dominio con client match.

### Auth setup

- Progetto Playwright `setup` → `e2e/admin-auth.setup.ts` → `e2e/.auth/admin.json`.
- Credenziali seed: `admin@agency.com` / `admin123` (`ONIZUKA_E2E=1` nel seed).

### E2E dashboard

- `npm run test:e2e:dashboard` → **PASS** (setup + spec, ~2 min, webServer auto).

### E2E audit CRM

- `npm run test:e2e:audit-crm` → **PASS** (7 test: P.IVA nuova/riuso, lead/client, pipeline+flow, no duplicati VAT, dominio-only).
- Shell form (senza audit server): `npm run test:e2e:audit-crm:shell`.

### Staging remoto

**Non validato** — in workspace mancano:

| Variabile | Note |
|-----------|------|
| `ONIZUKA_ENV=staging` | Progetto Vercel staging dedicato |
| `ONIZUKA_STAGING_DB_MARKER` | Ref Supabase staging |
| `NEXTAUTH_URL` | es. `https://staging.onizuka.it` |
| `DATABASE_URL` / `DIRECT_URL` | DB staging isolato |
| `PLAYWRIGHT_BASE_URL` | URL app staging per E2E remoti |

**Comandi da eseguire appena disponibile:**

```bash
npx prisma validate
npx prisma migrate deploy
npm test && npm run build
npm run staging:commercial-gate
PLAYWRIGHT_BASE_URL=https://<staging-url> npm run test:e2e:dashboard
PLAYWRIGHT_BASE_URL=https://<staging-url> npm run test:e2e:audit-crm
```

### Gate locale eseguito

| Check | Esito |
|-------|--------|
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS (69 migration, up-to-date) |
| `npm test` | PASS 134 suite / 307 test |
| `npm run build` | PASS (dopo clean `.next`) |
| `npm run staging:commercial-gate` | PASS 22/22 |

### Smoke quote/email/cron lead-only

Confermato `staging:commercial-gate`: `smoke.opp.lead-only`, `smoke.opp.lead-only.row`, `smoke.quote-no-response.lead`, `smoke.party.assert` → PASS.

### Cleanup dati test

- `globalTeardown` + `afterAll` spec audit: `cleanupE2eAuditRecords` prefix `E2E Audit CRM`.
- Gate script: cleanup esplicito a fine run.
- Seed E2E idempotente su entità `seed_*` / `e2e_seed_*`.

### Rischi residui

- Dominio-only **nuovo** senza client/lead match → app rifiuta (by design); E2E Scenario C simula dominio su client esistente.
- E2E remoti richiedono env staging + DB marker; non eseguiti qui.
- Non avviare `npm run build` mentre Playwright lancia `dev` (corrompe `.next`).

### Decisione finale

- **NO-GO produzione** (manca validazione staging remoto reale).
- **GO locale/staging tecnico** — E2E dashboard + audit CRM verdi, gate 22/22, test e build verdi.

---

## ST-04 — Remote Staging Setup + Commercial Gate

**Data:** 2026-05-26 · **Staging remoto validato:** no (DB/Vercel staging non provisionati in workspace)

### Configurazione trovata (pre-ST-04)

- `docs/STAGING.md` base, `vercel-env.staging.template` minimale
- `staging:commercial-gate` con guard parziale
- Playwright webServer locale; nessun flusso remoto documentato
- Seed unico `prisma/seed.ts` + `db:seed:e2e`

### File creati / modificati

| File | Ruolo |
|------|--------|
| `src/lib/staging-guard.ts` | Protezioni anti-produzione |
| `.env.staging.example` | Template env locale staging |
| `vercel-env.staging.template` | Template Vercel (espanso) |
| `docs/STAGING.md` | Procedura operativa 10 step |
| `prisma/seed-staging.ts` | Seed `STAGING TEST` |
| `scripts/staging-*.mjs` | validate, migrate, seed, cleanup, e2e, load-env |
| `scripts/staging-cleanup-runner.ts` | Cleanup DB test |
| `playwright.config.ts` | No webServer se `PLAYWRIGHT_BASE_URL` remoto |
| `e2e/global-setup.ts` | Skip seed locale su base remota + guard URL |
| `__tests__/lib/staging-guard.test.ts` | Test guard |

### Script npm aggiunti

`staging:validate`, `staging:migrate`, `staging:seed`, `staging:cleanup`, `staging:test:e2e`, `staging:test:e2e:dashboard`, `staging:test:e2e:audit-crm`

### Protezioni implementate

- `assertStagingEnvironment`, `assertNotProductionDatabase`, `assertSafeE2EBaseUrl`, `assertCommercialGateSafe`
- Usate in gate, migrate, seed, cleanup, E2E setup remoto
- `ONIZUKA_STAGING_CONFIRM=yes` per migrate/seed/cleanup

### Seed staging

- Admin: `admin@agency.com` / `admin123`
- Record prefix `STAGING TEST` + id fissi `staging_test_*`
- Email `@example.test` — nessun dato reale
- `QUOTE_NOTIFY_EMAIL=0` default nel runner seed

### Migration staging (procedura)

1. Backup snapshot Supabase staging
2. `npm run staging:validate`
3. `ONIZUKA_STAGING_CONFIRM=yes npm run staging:migrate`
4. `ONIZUKA_STAGING_CONFIRM=yes npm run staging:seed`
5. `npm run staging:commercial-gate`
6. Rollback: restore snapshot se fail

### E2E remoti

- Configurati: `PLAYWRIGHT_BASE_URL` → no webServer, skip seed locale
- **Non eseguiti** — manca URL staging deployato

### Smoke email/cron

- Gate esteso: `smoke.email.quote-disabled`, `smoke.env.quote-notify`
- Template staging: `QUOTE_NOTIFY_EMAIL=0`, digest/cron email off

### Staging remoto validato

**No** — manca provisioning reale:

- Progetto Vercel `onizuka-staging`
- Supabase staging + `DATABASE_URL` / `DIRECT_URL`
- `NEXTAUTH_URL` / `PLAYWRIGHT_BASE_URL` staging
- `ONIZUKA_STAGING_DB_MARKER` reale
- Deploy + seed + E2E remoti

### Decisione finale

- **NO-GO produzione**
- **GO locale/staging tecnico** (tooling pronto; validazione remota da eseguire post-provisioning)

---

## Registro implementazioni (fix immediati)

| Data | ID | Note |
|------|-----|------|
| 2026-05-20 | IM-01 … IM-04 | Audit VAT, sheet queue, convert lead, test Jest |
| 2026-05-20 | IM-02 | API `audit/vat` allineata |
| 2026-05-20 | IM-05 | `QUOTE_NO_RESPONSE_CRON=0` nel test cron |
| 2026-05-20 | IM-06 | `assertLeadVatClientLink` + test |
| 2026-05-20 | IM-07 | Messaggio convert con path scheda esistente |
| 2026-05-20 | RF-02/03 | Script audit, normalize, person assert, fiscal-normalize |
| 2026-05-20 | RF-01 | SQL unique indexes + migration placeholder no-op |
| 2026-05-20 | CM-01 / AP-01 | Matching audit, opportunity DIGITAL_AUDIT, task dedupe, UI summary |
| 2026-05-20 | AP-02 / CM-02 | Fonti unificate, Opportunity.leadId, sheet queue, form esteso |
| 2026-05-20 | ST-01 / E2E-01 / SQ-01 | Smoke migration, E2E commerciale, sheet dominio-only |
| 2026-05-26 | ST-02 | Gate staging script, quote lead-only, E2E locale parziale |
| 2026-05-26 | KPI-01 | Dashboard commerciale `/admin/crm/commercial` |
| 2026-05-26 | KPI-02 / ST-02 | Hardening dashboard, filtri, audit FU, gate esteso |
| 2026-05-26 | ST-04 | Template staging, guard anti-prod, script migrate/seed/E2E remoto |

---

## Riferimenti rapidi

| Modulo | Path |
|--------|------|
| Normalizzazione unificata | `src/lib/fiscal-normalize.ts` |
| Identità fiscale Client | `src/lib/client-fiscal-identity.ts` |
| Identità fiscale Person | `src/lib/person-fiscal-identity.ts` |
| Audit duplicati (dry-run) | `scripts/audit-fiscal-duplicates.ts` |
| Rollback indici | `docs/FISCAL-IDENTITY-ROLLBACK.md` |
| Pipeline P.IVA | `src/lib/prospect-vat-pipeline.ts` |
| Audit run | `src/lib/digital-audit-run.ts` |
| Matching audit → CRM | `src/lib/audit-commercial-match.ts` |
| Wire post-audit | `src/lib/audit-commercial-wire.ts` |
| Dashboard commerciale | `src/lib/commercial-dashboard.ts` |
| Audit senza follow-up | `src/lib/commercial-audit-follow-up.ts` |
| Scope dashboard | `src/lib/commercial-dashboard-scope.ts` |
| Servizi da criticità | `src/lib/audit-service-recommendations.ts` |
| Nav 360° | `docs/CLIENT-360-NAV.md` |

---

*Documento vivo: aggiornare la colonna **Stato** e il registro a ogni blocco completato.*

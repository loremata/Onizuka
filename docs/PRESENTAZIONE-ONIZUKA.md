# Onizuka — Presentazione piattaforma

_Documento commerciale e funzionale · maggio 2026_

---

## In una frase

**Onizuka** è il sistema operativo intelligente per agenzie e studi che vogliono gestire clienti, vendite, contenuti, finanza e operatività in un’unica piattaforma — con memoria contestuale, automazioni e portale cliente integrato.

---

## Per chi è pensata

| Profilo | Cosa ottiene |
|---------|----------------|
| **Titolare / direzione** | Command Center, KPI, intelligence, revenue at risk, go-live controllato |
| **Commerciale / CRM** | Lead, pipeline, opportunità, preventivi, segnalatori, dedupe, reach |
| **Operations / account** | Clienti 360°, flow task, calendario, ticket, onboarding, commitment |
| **Creativi / social** | Approvazione contenuti, Social Pro, piano editoriale, pubblicazione |
| **Amministrazione** | Finanza, time tracking, ERP, FatturaPA, riconciliazione |
| **Cliente finale** | Portale: approva post, carica creatività, fatture, ticket, progetti |

---

## Valore distintivo

1. **Un solo posto** — CRM, task, memoria, finanza, audit, outreach e portale cliente non sono silos separati.
2. **Action Inbox** — priorità operative unificate (task, reach, ticket, finanza, audit, post).
3. **Memoria Onizuka** — note e contesto cifrati, RAG e ricerca semantica per decisioni e assistente.
4. **Automazioni native** — regole con condizioni, retry, audit esecuzioni; integrazione n8n per pubblicazione social.
5. **Go-live misurabile** — checklist, diagnostica e smoke test integrati (`/admin/go-live`).

---

## Macro-aree e funzionalità

### 1. Onizuka Core — Command Center

| Funzione | Descrizione |
|----------|-------------|
| Dashboard `/admin` | KPI, trend, priorità, snippet CRM operativo |
| Action Inbox | Coda unificata di azioni da svolgere |
| Ricerca globale | Clienti, lead, opportunità, memoria, post |
| Barra comando | Navigazione rapida e **Ask Onizuka** (orchestrazione con memoria) |
| Regia operativa | Foglio giornaliero operativo e KPI giornalieri |
| Intelligence | Raccomandazioni NBA, refresh automatico |
| Notifiche | In-app + digest email configurabile |
| Go-live hub | Readiness produzione, env, deploy status |
| Attività | Registro attività cross-modulo |

**Integrazioni cron:** digest notifiche, intelligence refresh, meeting follow-through, ops weekly digest.

---

### 2. Onizuka CRM

#### Clienti e asset commerciali

- Anagrafica multi-tenant, contatti, asset, health score, milestone
- Onboarding checklist e commitment per cliente
- Google Drive: struttura cartelle per cliente
- GBP: recensioni e segnali locali
- Audit digitale marketing (trigger da scheda cliente)
- Contratti retail e rinnovi
- Impersonazione portale per preview admin

#### Lead e pipeline commerciale

- Lead: CRUD, import/export, quick status da banco, **walk-in pubblico** (`/walkin`)
- Convert lead → cliente
- Opportunità, pipeline Kanban, SLA e bottleneck
- Preventivi: righe, PDF, invio email, stati
- Analytics lead, dormant clients, health radar
- **Dedupe CRM** con scan, embedding e training modelli
- Segnalatori: portale referral, payout, magic link

#### Contatti e vendite

- Rubrica contatti unificata
- Sales stats, ecosistema brand/servizi commerciali

---

### 3. Onizuka Flow

- Task operativi con stati, scadenze, filtri “due today”
- Sync Google Calendar
- Promemoria via cron notifiche

---

### 4. Onizuka Memory

- Vault memoria con scope (cliente, opportunità, globale, …)
- Export policy, cifratura, rotazione chiavi
- Embedding + **pgvector** per RAG
- Reindex e backfill da script
- Integrazione con Ask Onizuka e Voice

---

### 5. Onizuka Content (approvazioni)

- Creazione post multi-piattaforma (Facebook, Instagram, LinkedIn, GBP)
- Upload media (S3/R2 o locale in dev)
- Workflow: Pending → Approved / Needs revision
- Commenti e storico; webhook verso **n8n** per pubblicazione
- API n8n: `approved`, `mark-published`

---

### 6. Onizuka Social Pro

- Hub social admin + sync Meta / Instagram / LinkedIn
- Calendario editoriale, inbox commenti, engagement report
- Metriche social per cliente

---

### 7. Onizuka Reach (outreach)

- Bozze outreach, mailto, tracking click
- Sequenze multi-step con A/B
- WhatsApp: linee, template, inbox (Meta webhook)
- Cron dedicato sequenze reach

---

### 8. Onizuka Finance

- Prima nota / ledger, entrate e uscite
- Riconciliazione bancaria, export contabilità
- FatturaPA, PDF fatture, SDI
- MRR, forecast, scaduti, rinnovi
- Stripe checkout nel **portale cliente** per pagamento fatture

---

### 9. Onizuka Time

- Time entry con doppia approvazione
- Export e push verso ERP (Zucchetti / SAP partner cert)
- Pull certificato ore da ERP

---

### 10. Onizuka Audit

- Audit log amministrativo (azioni sensibili)
- Lookup P.IVA
- **Audit digitale:** sezioni, PDF, coda Google Sheet, probe sito
- Token report pubblico per condivisione

---

### 11. Onizuka Insights

- Raccomandazioni servizi, service graph
- Revenue at risk
- Forecast pipeline (route dedicata)
- Report attivazioni servizi mensili

---

### 12. Onizuka Voice

- Recap vocale giornaliero
- TTS (cache, ElevenLabs opzionale)
- Invio Telegram
- Policy autonomia e wake word

---

### 13. Automazioni e integrazioni

| Area | Capacità |
|------|----------|
| **Regole automazione** | Trigger (lead, ticket, finanza, email, …), condizioni, operatori, retry, dead letter |
| **Flow builder** | Editor visuale regole |
| **Control Center** | Catalogo cron, capacità env |
| **Webhook n8n** | POST_APPROVED, firma HMAC, retry delivery |
| **OAuth** | Google Calendar, Gmail, GBP, ERP |
| **Telegram / WhatsApp** | Bot e template |
| **Stripe** | Webhook pagamenti |

**Cron GitHub Actions:** notifiche, reach-sequences, webhook-retry, audit-sheet-queue, dedupe-training.

---

### 14. Onizuka Client Portal

Il cliente accede a `/app` con ruolo **CLIENT** (isolamento tenant).

| Sezione | Cosa fa il cliente |
|---------|-------------------|
| Dashboard | KPI personali |
| Contenuti | Approva o richiede revisioni sui post |
| Invia creatività | Upload con crop |
| Piano editoriale | Visualizza piano |
| Social Pro | Vista social dedicata |
| Fatture | Elenco e pagamento Stripe |
| Progetti | Avanzamento progetti |
| Galleria | Media |
| Supporto | Ticket con allegati e aggiornamenti |
| Notifiche | Centro notifiche |
| Password | Cambio credenziali |

---

### 15. Utenti, sicurezza, staff

- Ruoli: **ADMIN**, **STAFF** (moduli whitelist), **CLIENT**
- Permessi granulari per path admin
- Policy password, seed check, audit log
- Rate limit login e API n8n

---

## Architettura tecnica (sintesi)

| Layer | Tecnologia |
|-------|------------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind, shadcn-style UI |
| Backend | Server Actions, Route Handlers, Prisma |
| Database | PostgreSQL (+ pgvector per memoria/dedupe) |
| Auth | NextAuth Credentials, JWT con role/clientId |
| Storage | S3-compatible (Cloudflare R2 in prod) |
| Cache / rate limit | Upstash Redis (prod) |
| Deploy | Vercel + Supabase + GitHub Actions cron |
| AI | Provider LLM astratto, embedding memoria |

**~96 pagine admin**, **~14 portale cliente**, **~300 moduli** in `src/lib/`, **40+ modelli** Prisma.

---

## Cosa puoi fare con Onizuka (scenari)

1. **Agenzia marketing** — Gestire 50 clienti: approvazioni post, calendario, ticket, fatture e memoria per ogni account manager.
2. **Studio commerciale telecom/energy** — Lead walk-in, pipeline, preventivi, rinnovi retail, reach WhatsApp.
3. **Consulenza digitale** — Audit sito + GBP, report PDF, follow-up sequenze email.
4. **Operations interne** — Flow task, time → ERP, regia giornaliera, intelligence su colli di bottiglia.
5. **Partner / segnalatori** — Portale referral con commissioni e payout tracciati.

---

## Verifica piattaforma (maggio 2026)

### Branding Onizuka

| Controllo | Esito |
|-----------|--------|
| UI admin/portale (`layout`, metadata) | **Onizuka** |
| Riferimenti `StationHQ` in `src/` | **Rimossi** (rinominato `crm-ops-panel`) |
| Doc funzionale | Solo **Onizuka**; StationHQ citato solo come archivio storico in `docs/PRODUCT-STATUS.md` |
| Seed brand “Online Station” | Nome commerciale cliente (dominio), non prodotto |

### Collegamenti e coerenza

| Controllo | Esito |
|-----------|--------|
| Nav admin ↔ route | Allineato (`layout.tsx` + permessi STAFF) |
| Moduli Prisma ↔ API admin | Coerente (migrazioni 63+, batch F/G) |
| Cron ↔ workflow GHA | 5 workflow documentati |
| Checklist ops | `PASSI-MANCANTI.md` + `/admin/go-live` |
| Documentazione | Indice `docs/README.md` |

### Test automatici (locale)

```text
npm run passi-mancanti:full   → exit 0 (check + smoke 7/7 + cron 3/3 + Jest upload)
npm test                      → 227/227 pass
```

**Verifica consigliata prima del go-live:**

```bash
npm run db:up && npm run db:deploy && npm run db:seed:e2e
npm run passi-mancanti:full
npm run passi-mancanti:e2e
BASE_URL=https://onizuka.it npm run passi-mancanti:prod
```

---

## Proposte di miglioramento

### Processi e operatività

| Priorità | Proposta | Beneficio |
|----------|----------|-----------|
| Alta | Completare checklist `PASSI-MANCANTI.md` (Supabase, R2, DNS, SMTP, GHA secrets) | Go-live produzione stabile |
| Alta | Runbook unico incidenti (DB, cron, webhook) in `docs/` | Riduce MTTR |
| Media | Dashboard SLA team (ticket + opp + flow) | Visibilità carico |
| Media | Template onboarding cliente per settore | Velocizza attivazione |
| Bassa | Report PDF mensile automatico per cliente | Upsell portale |

### Stack e infrastruttura

| Priorità | Proposta | Beneficio |
|----------|----------|-----------|
| Alta | Redis Upstash obbligatorio in prod (già previsto) | Rate limit e cache affidabili |
| Media | Worker dedicato coda automazioni (K8s/CF Worker) vs batch nel cron notifiche | Throughput regole |
| Media | Observability: Sentry + structured logs su cron | Debug produzione |
| Media | Preview Vercel con DB staging isolato (`docs/STAGING.md`) | Test PR sicuri |
| Bassa | Upgrade Next.js 15 quando ecosystem stabile | Performance e DX |

### Funzionalità aggiuntive

| Priorità | Proposta | Allineamento |
|----------|----------|--------------|
| Alta | Mobile PWA portale cliente (notifiche push) | Engagement cliente |
| Alta | 2FA / passkey per admin | Sicurezza |
| Media | BI export (BigQuery / Metabase) da finance + CRM | Decisioni direzione |
| Media | Template preventivo per brand/servizio | Vendite più veloci |
| Media | Inbox email unificata (Gmail già OAuth) nel Action Inbox | Meno context switch |
| Media | Social publishing nativo oltre n8n | Meno dipendenza esterna |
| Bassa | Multi-workspace / white-label partner | Scalabilità agenzia |
| Bassa | Compliance audit legale (GDPR DSAR) | Enterprise |

### Qualità codice

| Priorità | Proposta |
|----------|----------|
| Alta | Stabilizzare 6 test Jest falliti con DB Docker + timeout upload |
| Media | E2E upload portale con `storageState` admin→impersonate fix |
| Bassa | Nav secondaria: raggruppare voci in dropdown per ridurre overload |

---

## Slide e PDF

| Artefatto | Comando |
|-----------|---------|
| [presentazione/slides.html](./presentazione/slides.html) | Apri nel browser (presentazione fullscreen) |
| `Onizuka-Presentazione.pdf` | `npm run presentazione:pdf` (genera in `docs/presentazione/`) |

---

## Documenti correlati

| Documento | Uso |
|-----------|-----|
| [PASSI-MANCANTI.md](../PASSI-MANCANTI.md) | Checklist deploy |
| [GO-LIVE-OPS-PLAYBOOK.md](./GO-LIVE-OPS-PLAYBOOK.md) | 17 passi cloud |
| [ROADMAP-MIGLIORAMENTI.md](./ROADMAP-MIGLIORAMENTI.md) | Tutte le proposte di miglioramento |
| [RUNBOOK-INCIDENTI.md](./RUNBOOK-INCIDENTI.md) | Incidenti produzione |
| [ONIZUKA_MASTER_SPEC.md](./ONIZUKA_MASTER_SPEC.md) | Spec moduli P0 |
| [PRODUCT-STATUS.md](./PRODUCT-STATUS.md) | Stato implementazione |
| [ONIZUKA-AUDIT-GAP.md](./ONIZUKA-AUDIT-GAP.md) | Audit moduli |
| [GO-LIVE.md](./GO-LIVE.md) | Hub release |

---

_Piattaforma: codice MVP + port storico completi. Produzione: solo attività ops cloud._

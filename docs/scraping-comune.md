# Scraping aziende per comune → Lead

Sezione admin per costruire il database aziende di un comune e importarlo come
Lead in Onizuka, deduplicato e senza aziende cessate.

## Architettura

```
[Onizuka /admin/crm/scraping]  provincia + comune → "Avvia"
        │  crea una riga ScrapeJob (status QUEUED)  [gira su Vercel]
        ▼
[Worker sul PC]  polla i job, esegue e aggiorna il progresso
        │  registro → Places → dedup → import Lead
        ▼
[DB Onizuka]  Lead attivi, deduplicati; la UI mostra i contatori
```

Il worker gira **fuori da Vercel** perché il crawl è lungo (1-2 h per comune) e
usa `curl` (l'anti-bot di registroaziende blocca il fingerprint TLS di Node).

## Pipeline (worker)

1. **registro** (`src/lib/scraping/registro.ts`) — registroaziende.it: elenco del
   comune + schede. Estrae Stato, P.IVA, ATECO, indirizzo, dipendenti.
2. **places** (`src/lib/scraping/places.ts`) — Google Places API: sito, telefono,
   rating, recensioni (i dati GBP dalla fonte ufficiale).
3. **resolve** (`src/lib/scraping/resolve.ts`) — entity resolution: fonde i record
   che sono la stessa azienda (union-find su P.IVA, place id, telefono, dominio
   sito, nome+via). **Zero doppioni.** Tiene solo le **attive**.
4. **import** (`src/lib/scraping/import-leads.ts`) — crea i Lead deduplicando
   contro il CRM esistente (P.IVA su Client/Lead; telefono/dominio per le
   solo-Google). In bulk non scatena notifiche/automazioni.

## Setup (una volta)

1. **Migrazione DB** (aggiunge la sola tabella `ScrapeJob`, additiva):
   ```bash
   npx prisma migrate dev --name add_scrape_job     # in locale/dev
   # in produzione: npx prisma migrate deploy
   ```
2. **Env del worker** — in `.env.local` (o env del PC):
   ```
   DATABASE_URL=...            # il Postgres/Supabase di Onizuka
   GOOGLE_PLACES_API_KEY=...   # chiave Places API (New)
   ```

## Uso

1. Avvia il worker sul PC: doppio-click su `scripts/avvia-worker.bat`
   (oppure `pnpm run scraper:worker`). Lascia la finestra aperta.
2. In Onizuka: **CRM → Scraping aziende**, scegli provincia e comune, **Avvia**.
3. La barra mostra: registro → Google → dedup → creazione Lead, con i contatori
   (trovate, attive, escluse, arricchite, lead creati, già presenti).

## Auto-audit dopo lo scraping

Ogni Lead attivo importato viene messo in **coda audit** (riusa `AuditSheetQueueItem`,
marcato `sheetRowKey = "scraping:<leadId>"`). Un cron dedicato lo processa:

- **Cron**: `/api/cron/scraping-audit` — ogni 3h (`vercel.json`).
- **Tetto**: `SCRAPING_AUDIT_DAILY_CAP` (default **20 audit/giorno**), per non sovraccaricare.
- **Per ogni audit**: PDF interno + PDF cliente, link report pubblico (`/report/[token]`),
  bozza 1ª email (`PENDING_APPROVAL`), script call, DM LinkedIn. Stato lead →
  **`AWAITING_SEND_APPROVAL`** (attende la tua approvazione per l'invio).
- Dopo approvazione+invio → `FIRST_AUDIT_MAIL_SENT` + tracking apertura (pixel esistente).

Il cron della coda Google Sheet (`/api/cron/audit-sheet-queue`) **ignora** gli item
scraping (filtro dedicato): i due canali non si pestano i piedi.

## Deploy in produzione (checklist)

1. Merge del branch in `main`.
2. **DB Supabase**: `npx prisma db push` (aggiunge solo la tabella `ScrapeJob`; l'audit
   riusa tabelle esistenti — nessun altro nuovo model).
3. **Env Vercel**: aggiungere `GOOGLE_PLACES_API_KEY`. `CRON_SECRET` esistente copre il
   nuovo cron. Opzionale: `SCRAPING_AUDIT_DAILY_CAP` per cambiare il tetto.
4. **Worker sul PC**: crea `.env.worker` (gitignorato) con `DATABASE_URL` = connessione
   **prod** Supabase + `GOOGLE_PLACES_API_KEY`. Il worker lo carica con priorità sul
   `.env` di dev, così il dev locale resta separato dalla produzione. Poi `scripts/avvia-worker.bat`.

## Canale Google Sheet (ritiro futuro)

Lo scraping sostituisce il **canale di ingresso** "foglio Google", ma il **motore** della
coda audit è condiviso e resta necessario. Non rimuovere `AuditSheetQueueItem`, il
processore, né `runDigitalAuditUnified`. Quando lo scraping è consolidato in produzione,
si può ritirare solo la parte *sheet-specific* (UI coda sheet, `audit-sheet-ingest`,
writeback, e disattivare `GOOGLE_SHEET_AUTO_SYNC_CRON`/il cron `audit-sheet-queue`) in un
intervento dedicato.

## Note

- **Comuni**: dataset ISTAT in `src/lib/scraping/comuni-italia.ts` (7.904 comuni).
  Lo slug registroaziende è calcolato con fallback (`registro-slug.ts`).
- **Cessate/in liquidazione**: mai importate come Lead.
- **Dedup**: un'azienda già presente (per P.IVA o contatto) viene saltata →
  niente doppia mail alla stessa azienda.
- Il worker processa un comune alla volta; più richieste si accodano.

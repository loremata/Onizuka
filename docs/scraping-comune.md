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

## Note

- **Comuni**: dataset ISTAT in `src/lib/scraping/comuni-italia.ts` (7.904 comuni).
  Lo slug registroaziende è calcolato con fallback (`registro-slug.ts`).
- **Cessate/in liquidazione**: mai importate come Lead.
- **Dedup**: un'azienda già presente (per P.IVA o contatto) viene saltata →
  niente doppia mail alla stessa azienda.
- Il worker processa un comune alla volta; più richieste si accodano.

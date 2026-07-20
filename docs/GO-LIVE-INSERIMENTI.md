# Go-live modulo "Onizuka - Inserimenti"

Stato al 18/07/2026: modulo completo e validato sul DB locale. Branch
`feat/onizuka-inserimenti` pushato su origin. Restano i passi che toccano la
**produzione** (DB Supabase + sito su Vercel), da eseguire dove esistono le
credenziali di produzione — **non presenti su questa macchina**
(`.env.production.local` è vuoto; le env di prod stanno su Vercel).

## Ordine OBBLIGATORIO

La migration deve girare **prima** del deploy del codice: se `main` viene
deployato prima che le tabelle esistano, `/admin/inserimenti` va in errore in
produzione (tabelle mancanti).

```
1) migration DB prod   →   2) seed config (piani+listino)   →   3) merge/deploy   →   4) smoke test
```

## 1 · Migration sul DB di produzione

La migration aggiunge SOLO due cose (verificate additive, zero DROP/DELETE):
- tabelle del modulo (`IncentivePlan`, `IncentiveLine`, `StoreSale`, `StoreOffer`, …)
- colonna `StoreOffer.compensoEur`

Serve la **connessione diretta** (porta 5432, NON il pooler 6543): le migration
non passano da pgbouncer.

Metti in `.env.production.local` (da Vercel → Settings → Environment Variables):
```
DATABASE_URL="postgresql://postgres.<ref>:<password>@<host>:5432/postgres"
DIRECT_URL="postgresql://postgres.<ref>:<password>@<host>:5432/postgres"
```
Poi:
```bash
npx dotenv -e .env.production.local -- npx prisma migrate deploy
```
Applica solo le migration pendenti (mai reset). Attese: `onizuka_inserimenti`,
`offer_compenso`.

## 2 · Seed della configurazione (piani + listino)

⚠️ **Verificare l'utente proprietario prima di seedare.** Gli script assegnano
i dati al **primo utente ADMIN per data di creazione**. In produzione dev'essere
l'account reale di Lorenzo, non un eventuale `admin@agency.com` di demo. Se serve,
si passa l'email giusta (vedi nota sotto).

Sequenza che riproduce lo stato attuale (stesso ordine con cui è stato costruito):
```bash
D="npx dotenv -e .env.production.local --"
$D npx tsx scripts/seed-inserimenti.ts          # piani TIM + brand lineari
$D npx tsx scripts/import-listino-tim.ts         # 75 offerte TIM dal CSV
$D npx tsx scripts/import-listino-fastweb.ts     # offerte Fastweb + piste business/energia
$D npx tsx scripts/aggiorna-compensi-18lug.ts    # Fastweb energia/business, Iliad, Enel, Telepass TWIN/Europa
$D npx tsx scripts/categorie-e-compensi.ts       # categoria "Telefono incluso" + compensi per offerta Fastweb
$D npx tsx scripts/canoni-tutti-prodotti.ts      # canoni + offerte Iliad/Enel/Eni
```
Il CSV listino TIM è in `Ecosistema Commerciale/TIM/_LISTINO_COMPLETO_TIM_30-06-2026.csv`
(passare il percorso a `import-listino-tim.ts` se lanciato da altra postazione).

**Dati di vendita (giugno+luglio):** sono dati operativi, non configurazione.
Se si vuole lo storico anche in prod: `$D npx tsx scripts/import-inserimenti-foglio.ts`
(legge `[INSERIMENTI NEGOZIO].xlsx`). I 2 contratti Energia del 18/07 aggiunti a
mano vanno reinseriti dall'interfaccia in prod, oppure aggiunti allo script.

## 3 · Merge e deploy

Solo DOPO che 1 e 2 sono confermati:
```bash
git checkout main && git merge feat/onizuka-inserimenti && git push origin main
```
Porta in main anche il commit di sicurezza Publisher/Analytics/Competitor
(autorizzato). Vercel fa il deploy di produzione in automatico.

## 4 · Smoke test in produzione

- login → `/admin/inserimenti` carica senza errori
- il totale del mese e le schede per brand mostrano i dati
- `/admin/inserimenti/registra` registra una vendita di prova, poi eliminarla

## Come farlo eseguire a Claude senza esporre la password

Popolare `.env.production.local` (Claude NON lo legge né lo stampa) e dire
"esegui il go-live": Claude lancia i comandi sopra usando quel file, la
password resta sul disco e non entra nella chat.

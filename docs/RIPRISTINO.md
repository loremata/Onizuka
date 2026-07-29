# Backup e ripristino

Procedura **provata sul serio e cronometrata** il 29/07/2026 su un database di
scarto. Non è teoria: i numeri qui sotto vengono da un'esecuzione reale.

## Il risultato della prova

| Fase | Tempo |
|---|---|
| Backup della produzione | **14 s** |
| Preparazione del database vuoto | 1 s |
| Ripristino | **2 s** |
| **Totale, da zero a operativo** | **~17 s** |

Dimensione del database: 53 MB · dimensione del backup compresso: **1,8 MB**.

**Verifica di integrità:** conteggi identici su 13 tabelle (1.028 clienti,
89 vendite, 1.158 lead, 854 audit, 1.152 bozze, 1.066 sequenze, 7 piani
incentivi, 52 soglie, 110 offerte, 407 notifiche, 1 voce finance, 2 contratti,
1 utente).

**Verifica funzionale** — quella che conta davvero: il motore compensi
ricalcolato *sulla copia ripristinata* restituisce **2.750,19 €** per luglio,
identico al centesimo alla produzione, con la stessa scomposizione per brand e
gli stessi 7,5 punti di accessi. Il ripristino non è solo strutturale: il
sistema ci funziona sopra.

## ⚠️ La cosa che la prova ha scoperto

Il backup **non si ripristina su un Postgres normale**. Il database usa
l'estensione `pgvector` (colonne `vector(1536)` su `Client` e `MemoryItem`, per
la deduplica e la memoria semantica). Senza l'estensione il ripristino fallisce
con **56 errori**: non si crea nessuna tabella, quindi non si recupera niente.

Alla prima prova è successo esattamente questo. È il motivo per cui una prova di
ripristino va fatta *prima* di averne bisogno.

Attenzione anche all'ordine: l'estensione va installata **dentro** lo schema
`public` **dopo** averlo ricreato. Installandola prima di eliminare lo schema
sparisce insieme a lui — errore in cui si cade al primo tentativo.

## Procedura

Servono Docker e le credenziali del superuser (`postgres`) in
`CREDENZIALI-Onizuka_RISERVATO.md`. Su Git Bash anteporre `MSYS_NO_PATHCONV=1`,
altrimenti i percorsi `/tmp/...` vengono tradotti in percorsi Windows.

### 1. Backup

```bash
docker run -d --rm --name onizuka-restore -e POSTGRES_PASSWORD=temp -e POSTGRES_DB=restore_test pgvector/pgvector:pg17
docker exec -e PGPASSWORD='<password-postgres>' onizuka-restore pg_dump \
  -h aws-0-eu-west-1.pooler.supabase.com -p 5432 -U postgres.hswxcxtnkrtvgxsuadzy -d postgres \
  --format=custom --no-owner --no-acl --schema=public -f /tmp/onizuka.dump
docker cp onizuka-restore:/tmp/onizuka.dump ./onizuka-$(date +%Y%m%d).dump
```

L'immagine **deve** essere `pgvector/pgvector:pg17`: la versione di `pg_dump`
non può essere più vecchia del server (produzione è PostgreSQL 17.6).

### 2. Ripristino

```bash
docker exec -e PGPASSWORD=temp onizuka-restore psql -h 127.0.0.1 -U postgres -d restore_test \
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;"
docker exec -e PGPASSWORD=temp onizuka-restore pg_restore \
  -h 127.0.0.1 -U postgres -d restore_test --no-owner --no-acl /tmp/onizuka.dump
```

Un solo errore atteso e innocuo: `schema "public" already exists`, perché il
backup prova a ricrearlo. Se gli errori sono 56, manca `pgvector`.

### 3. Verifica

Non fidarsi del fatto che il comando sia finito senza errori. Confrontare i
conteggi delle tabelle principali con la produzione, e **ricalcolare il totale
compensi del mese**: se torna, il ripristino è buono davvero.

## Cosa manca ancora

Questa procedura è manuale. Restano due decisioni:

1. **Nessun backup automatico.** Supabase sul piano gratuito non offre il
   recupero a un istante preciso: se il database si corrompe oggi, l'unica copia
   è quella che hai fatto a mano. Le opzioni sono un piano a pagamento oppure
   un backup schedulato che scrive su S3 (lo storage c'è già).
2. **Dove tenere le copie.** Non nella cartella sincronizzata su Drive insieme
   alle credenziali: un backup contiene tutti i dati dei clienti in chiaro.

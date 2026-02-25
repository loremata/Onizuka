# Guida passo passo: mettere online il SaaS (da zero a online)

Questa guida ti porta dal tuo codice fino all’app funzionante su internet: **GitHub → Database → Storage → Vercel → variabili → migrazioni → primo accesso**. Segui i passi in ordine.

---

## Cosa ti serve prima di iniziare

- **Account GitHub** (gratis): [github.com](https://github.com) → Sign up
- **Account Vercel** (gratis): [vercel.com](https://vercel.com) → Sign up (puoi usare “Continue with GitHub”)
- **Account per il database**: uno tra Neon, Vercel Postgres o Supabase (tutti hanno piani gratis)
- **Account per i file (immagini/video)**: Cloudflare (per R2) o AWS (per S3), con piano che permetta un bucket
- **Sul PC**: Node.js installato e **Git** (per il terminale)

Se non hai mai usato il terminale: su Windows apri **PowerShell** o **Prompt dei comandi**; su Mac **Terminale**. I comandi sotto vanno eseguiti nella cartella del progetto.

---

## PARTE 1 — Mettere il progetto su GitHub

### 1.1 Aprire il terminale nella cartella del progetto

- Vai alla cartella dove si trova il progetto (dove vedi `package.json`, `prisma`, `src`, ecc.).
- Da Cursor/VS Code: menu **Terminal** → **New Terminal** (il terminale si apre già nella cartella giusta).
- Oppure da Windows: `cd` fino al percorso, ad esempio:
  ```bash
  cd C:\Users\TUO_NOME\cartella\client-content-approval-portal
  ```

### 1.2 Inizializzare Git (se non l’hai già fatto)

Controlla se esiste già una cartella `.git`:

```bash
dir .git
```

- Se vedi “File not found” (o simile), Git non è ancora inizializzato. Esegui:

```bash
git init
```

- Se la cartella `.git` c’è già, salta questo comando.

### 1.3 Creare il repository su GitHub

1. Vai su [github.com](https://github.com) e fai login.
2. Clicca il **+** in alto a destra → **New repository**.
3. **Repository name**: scegli un nome, ad esempio `content-approval-portal`.
4. Lascia **Public**.
5. **Non** spuntare “Add a README” (il progetto ce l’hai già).
6. Clicca **Create repository**.

### 1.4 Collegare il progetto al repository e fare il primo push

GitHub ti mostrerà dei comandi. Usa questi (sostituisci `TUO_USERNAME` e `NOME_REPO` con i tuoi):

```bash
git add .
git commit -m "Primo commit - progetto pronto per deploy"
git branch -M main
git remote add origin https://github.com/TUO_USERNAME/NOME_REPO.git
git push -u origin main
```

- Se ti chiede login: usa le tue credenziali GitHub (o un **Personal Access Token** se hai l’autenticazione a due fattori).
- Dopo il `git push` il codice è su GitHub.

---

## PARTE 2 — Creare il database PostgreSQL

L’app deve avere un database. Puoi usare uno di questi (tutti con piano gratuito):

- **Neon** (consigliato, semplice): [neon.tech](https://neon.tech)
- **Vercel Postgres**: [vercel.com/storage/postgres](https://vercel.com/storage/postgres)
- **Supabase**: [supabase.com](https://supabase.com)

### Esempio con Neon (stessi concetti con gli altri)

1. Vai su [neon.tech](https://neon.tech) e fai Sign up (puoi con GitHub).
2. **Create a project**: nome a piacere (es. `approval-portal`), regione vicina a te.
3. Clicca sul progetto → **Connection string** (o **Dashboard** → **Connection details**).
4. Scegli **Pooled connection** (non “Direct”). Copia l’URL che inizia con `postgresql://...`.
5. Tienilo da parte: è la tua **DATABASE_URL** (non condividerla e non metterla su GitHub).

Salva l’URL in un file di testo sul PC con nome tipo `variabili-produzione.txt`. Ti servirà dopo su Vercel.

---

## PARTE 3 — Creare lo storage per immagini e video (S3/R2)

Su Vercel i file non possono essere salvati sul server: servono un bucket **S3** o **R2**. Due opzioni semplici:

### Opzione A — Cloudflare R2 (consigliata, costo zero per uso moderato)

1. Vai su [dash.cloudflare.com](https://dash.cloudflare.com) e accedi.
2. Menu **R2** → **Overview** → **Create bucket**.
3. Nome bucket: es. `approval-portal-uploads` → **Create bucket**.
4. **API Token** (per avere chiavi S3-compatibili):
   - Menu **R2** → **Manage R2 API Tokens** → **Create API token**.
   - Nome: es. `approval-portal`.
   - Permissions: **Object Read & Write**.
   - Scegli il bucket che hai creato (o “Apply to all buckets”).
   - Clicca **Create API Token**.
5. Ti mostrerà:
   - **Access Key ID** → sarà `S3_ACCESS_KEY`
   - **Secret Access Key** → sarà `S3_SECRET_KEY`
   - **Endpoint** (es. `https://xxx.r2.cloudflarestorage.com`) → sarà `S3_ENDPOINT`
6. Nome del bucket che hai creato → sarà `S3_BUCKET`.
7. Per **S3_PUBLIC_URL** (per far vedere le immagini nell’app): in R2 puoi attivare “Public access” per il bucket e usare l’URL pubblico che Cloudflare ti dà, oppure lasciarlo vuoto e usare l’endpoint (dipende dalla configurazione R2). Per iniziare puoi lasciare vuoto e testare.

Salva in `variabili-produzione.txt`:

- `S3_BUCKET` = nome bucket
- `S3_ACCESS_KEY` = Access Key ID
- `S3_SECRET_KEY` = Secret Access Key
- `S3_ENDPOINT` = Endpoint (URL tipo `https://xxx.r2.cloudflarestorage.com`)
- `S3_REGION` = `auto` (per R2)
- `S3_FORCE_PATH_STYLE` = puoi provare `true` se gli URL non funzionano

### Opzione B — AWS S3

1. Vai su [console.aws.amazon.com](https://console.aws.amazon.com) → S3.
2. **Create bucket** → nome univoco, regione a piacere.
3. Crea un utente IAM con permessi S3 (PutObject, GetObject) e genera **Access Key**.
4. Salva:
   - `S3_BUCKET` = nome bucket
   - `S3_ACCESS_KEY` = Access Key
   - `S3_SECRET_KEY` = Secret Key
   - `S3_REGION` = es. `eu-west-1`

---

## PARTE 4 — Creare il progetto su Vercel e collegare GitHub

### 4.1 Importare il repository

1. Vai su [vercel.com](https://vercel.com) e accedi (con GitHub è comodo).
2. Clicca **Add New…** → **Project**.
3. Nella lista vedi i repository GitHub. Clicca **Import** accanto al repo del progetto (es. `content-approval-portal`).
4. **Configure Project**:
   - **Framework Preset**: Next.js (dovrebbe essere già selezionato).
   - **Root Directory**: lascia vuoto.
   - **Build Command**: `npm run build` (default).
   - **Output Directory**: lascia default.
   - **Install Command**: `npm install` (default).

### 4.2 (Importante) Aggiungere le variabili d’ambiente PRIMA del primo deploy

**Non** cliccare ancora **Deploy**. Prima aggiungi le variabili:

1. Nella stessa pagina, apri la sezione **Environment Variables**.
2. Per **ogni** riga sotto, clicca **Add** (o **Key** / **Value**) e inserisci nome e valore. Scegli **Production** (e se vuoi anche Preview).

| Nome (Key)       | Valore (Value) | Note |
|------------------|----------------|------|
| `DATABASE_URL`   | L’URL PostgreSQL che hai copiato (Neon/Vercel/Supabase) | Incolla tutto, con password |
| `NEXTAUTH_SECRET`| Una stringa lunga e casuale | Vedi sotto come generarla |
| `NEXTAUTH_URL`   | Per ora lascia vuoto | Lo imposti dopo il primo deploy (vedi passo 4.4) |
| `S3_BUCKET`      | Nome del bucket (es. `approval-portal-uploads`) | |
| `S3_ACCESS_KEY`  | Access Key (R2 o S3) | |
| `S3_SECRET_KEY`  | Secret Key (R2 o S3) | |
| `S3_ENDPOINT`    | Solo per R2: endpoint tipo `https://xxx.r2.cloudflarestorage.com` | Lascia vuoto se usi AWS S3 |
| `S3_REGION`      | Per R2: `auto`. Per AWS: es. `eu-west-1` | |
| `S3_FORCE_PATH_STYLE` | Per R2 spesso: `true` | Opzionale |

**Come generare NEXTAUTH_SECRET**

- Sul PC (PowerShell):
  ```powershell
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
  ```
- Oppure genera una stringa lunga casuale (es. 32 caratteri) su [randomkeygen.com](https://randomkeygen.com) e incollala.

### 4.3 Eseguire il primo deploy

1. Clicca **Deploy**.
2. Attendi 1–2 minuti. Se la build va a buon fine vedrai “Congratulations!” e un link tipo `https://tuo-progetto.vercel.app`.

### 4.4 Impostare NEXTAUTH_URL dopo il primo deploy

1. Nella pagina del progetto Vercel, vai in **Settings** → **Environment Variables**.
2. Aggiungi (o modifica):
   - **Key**: `NEXTAUTH_URL`
   - **Value**: l’URL della tua app **senza** barra finale, es. `https://tuo-progetto.vercel.app`
3. Salva. Poi **Redeploy**: **Deployments** → i tre puntini sul deploy più recente → **Redeploy** (così Vercel riavvia l’app con la nuova variabile).

---

## PARTE 5 — Creare le tabelle nel database (migrazioni)

Vercel non esegue le migrazioni da solo. Devi farle tu **una volta** dal tuo PC, usando l’URL del database di produzione.

### 5.1 Nel terminale (nella cartella del progetto)

Imposta la variabile con l’URL del database (sostituisci con la tua **DATABASE_URL** reale) e lancia le migrazioni:

**Windows (PowerShell):**

```powershell
$env:DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
npx prisma migrate deploy
```

**Mac/Linux:**

```bash
DATABASE_URL="postgresql://user:password@host/database?sslmode=require" npx prisma migrate deploy
```

- Usa **esattamente** l’URL che hai su Neon/Vercel/Supabase (copialo dalla dashboard o da `variabili-produzione.txt`).
- Se compare un errore tipo “no migrations found”, prima genera le migrazioni in locale (con un DB locale) con `npx prisma migrate dev --name init` e poi ripeti `prisma migrate deploy` con l’URL di produzione.

Se tutto va bene, vedrai qualcosa tipo “Applied 1 migration”. Le tabelle nel database di produzione sono pronte.

---

## PARTE 6 — Creare il primo utente admin (seed)

Per poter fare login serve almeno un utente. Puoi crearlo con lo script di seed.

### 6.1 Eseguire il seed verso il database di produzione

Sempre nel terminale, nella cartella del progetto (sostituisci con la tua **DATABASE_URL**):

**Windows (PowerShell):**

```powershell
$env:DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
npm run db:seed
```

**Mac/Linux:**

```bash
DATABASE_URL="postgresql://user:password@host/database?sslmode=require" npm run db:seed
```

Questo crea:

- **Admin**: email `admin@agency.com`, password `admin123`
- **Cliente demo**: `client@democlient.com`, password `client123`, e un client “Demo Client Co”

**Sicurezza:** dopo il primo accesso in produzione, cambia subito le password dall’area admin (o crea nuovi utenti e disattiva questi).

---

## PARTE 7 — Verifica: aprire l’app e fare login

1. Apri nel browser l’URL della tua app (es. `https://tuo-progetto.vercel.app`).
2. Dovresti essere reindirizzato alla pagina di **login**.
3. Accedi con:
   - Email: `admin@agency.com`
   - Password: `admin123`
4. Dopo il login dovresti vedere la dashboard admin (Clienti, Utenti, Post, Webhook).
5. Prova a creare un **nuovo post** con un’immagine: vai in **Posts** → **New post**, compila cliente, caption, carica un’immagine e salva. Se l’immagine si vede dopo il salvataggio, anche lo storage (S3/R2) funziona.

Se qualcosa non funziona, vedi sotto “Problemi comuni”.

---

## Riepilogo ordine operazioni

| # | Cosa fare | Dove |
|---|-----------|------|
| 1 | Mettere il codice su GitHub | Terminale + GitHub |
| 2 | Creare database e copiare DATABASE_URL | Neon / Vercel Postgres / Supabase |
| 3 | Creare bucket e chiavi S3/R2 | Cloudflare R2 o AWS S3 |
| 4 | Creare progetto Vercel, collegare GitHub, aggiungere **tutte** le variabili d’ambiente | Vercel |
| 5 | Primo deploy | Vercel (Deploy) |
| 6 | Impostare NEXTAUTH_URL e fare Redeploy | Vercel Settings |
| 7 | Eseguire migrazioni sul DB di produzione | Terminale (`prisma migrate deploy`) |
| 8 | Eseguire seed per primo utente | Terminale (`npm run db:seed`) |
| 9 | Aprire l’URL, login e test upload | Browser |

---

## Problemi comuni

- **“Storage: in production S3 is required”**  
  Su Vercel non hai impostato tutte le variabili S3/R2: `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`. Per R2 aggiungi anche `S3_ENDPOINT` e `S3_REGION=auto`.

- **Login non funziona / redirect strano**  
  Controlla che `NEXTAUTH_URL` sia **esattamente** l’URL dell’app (es. `https://tuo-progetto.vercel.app`) senza barra finale. Poi fai **Redeploy**.

- **Le immagini non si vedono**  
  Con R2 verifica `S3_PUBLIC_URL` o le impostazioni di accesso pubblico del bucket. Con S3 controlla permessi del bucket e eventuale `S3_PUBLIC_URL`.

- **Errore di connessione al database**  
  Controlla che `DATABASE_URL` sia corretto (password con caratteri speciali eventualmente codificati in URL). Per Neon/Vercel Postgres usa la **connection string in modalità pool**.

- **“No migrations found”**  
  Le migrazioni Prisma sono nella cartella `prisma/migrations`. Se non esiste, in locale (con un DB di test) esegui prima `npx prisma migrate dev --name init`, fai commit e push, poi su produzione `npx prisma migrate deploy` con `DATABASE_URL` di produzione.

---

## Dopo che è online

- **Dominio personalizzato**: in Vercel → **Settings** → **Domains** puoi aggiungere il tuo dominio.
- **n8n**: se usi n8n per pubblicare i post, imposta la variabile `N8N_API_KEY` su Vercel e usa quell’API key nelle chiamate alle API dell’app.
- **Backup**: il database è sul provider che hai scelto (Neon/Vercel/Supabase); i file sono su R2/S3. Fai backup periodici se necessario.

Se segui questi passi in ordine, il SaaS sarà online e funzionante da browser.

# Deploy su Vercel (via GitHub)

Checklist per pubblicare il Client Content Approval Portal su Vercel collegando il repository GitHub.

## Prerequisiti

- Repository GitHub con il codice del progetto
- Account Vercel
- Database PostgreSQL (Vercel Postgres, Neon, Supabase, Railway, ecc.)
- Bucket S3-compatibile per i file (AWS S3, Cloudflare R2, ecc.) — **obbligatorio in produzione**

## 1. Database

- Crea un database PostgreSQL (es. [Vercel Postgres](https://vercel.com/storage/postgres), [Neon](https://neon.tech), [Supabase](https://supabase.com)).
- In **serverless** è consigliato usare una **connection string in modalità pool** (es. `?pgbouncer=true` o URL “pooled” fornito dal provider) per evitare di esaurire le connessioni.
- Copia la **DATABASE_URL** (pooled se disponibile).

## 2. Storage (S3/R2) — Obbligatorio in produzione

Su Vercel il filesystem è effimero: **non** usare il fallback locale (`.uploads`). Configura sempre S3 o R2:

- **Cloudflare R2**: crea bucket e API token; usa `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL` (opzionale, per URL pubblici).
- **AWS S3**: `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`; opzionale `S3_PUBLIC_URL`.

Se in produzione S3 non è configurato, gli upload falliranno con un errore esplicito.

## 3. Repository GitHub

- Push del codice su GitHub (branch `main` o quello che userai per il deploy).
- Assicurati che `.env` e `.env.local` **non** siano committati (sono in `.gitignore`).

## 4. Progetto Vercel

1. Vercel Dashboard → **Add New** → **Project**.
2. Importa il repository GitHub e seleziona il progetto.
3. **Framework Preset**: Next.js (rilevato automaticamente).
4. **Root Directory**: lascia vuoto se la root del repo è la root del progetto.
5. **Build Command**: `npm run build` (default).
6. **Output Directory**: default Next.js (nessuna modifica).
7. **Install Command**: `npm install` (il `postinstall` esegue automaticamente `prisma generate`).

## 5. Variabili d’ambiente (Vercel)

In **Settings → Environment Variables** imposta (per **Production**, e se serve per Preview):

| Variabile | Obbligatoria | Note |
|-----------|--------------|------|
| `DATABASE_URL` | Sì | URL PostgreSQL (preferibilmente pooled per serverless). |
| `NEXTAUTH_URL` | Sì | URL pubblico dell’app, es. `https://tuodominio.vercel.app`. Per preview può essere `https://<branch>-<project>.vercel.app`. |
| `NEXTAUTH_SECRET` | Sì | Stringa casuale (es. `openssl rand -base64 32`). |
| `S3_BUCKET` | Sì (prod) | Nome bucket S3/R2. |
| `S3_ACCESS_KEY` | Sì (prod) | Access key. |
| `S3_SECRET_KEY` | Sì (prod) | Secret key. |
| `N8N_API_KEY` | Opzionale | Per le API n8n (`/api/n8n/approved`, `/api/n8n/mark-published`). |
| `S3_ENDPOINT` | Se usi R2 | Es. `https://xxx.r2.cloudflarestorage.com`. |
| `S3_REGION` | Opzionale | Es. `auto` per R2, `us-east-1` per AWS. |
| `S3_PUBLIC_URL` | Opzionale | Base URL pubblica degli oggetti (se il bucket è pubblico o hai un proxy). |
| `S3_FORCE_PATH_STYLE` | Opzionale | Imposta per R2/MinIO se richiesto. |

**Nota:** Su Vercel, `VERCEL_URL` è impostato automaticamente; puoi usare `NEXTAUTH_URL` = `https://<VERCEL_URL>` (senza trailing slash) oppure il dominio custom se ne configuri uno.

## 6. Migrazioni database

Le migrazioni Prisma **non** vengono eseguite automaticamente al deploy. Puoi:

- **Opzione A**: Eseguire le migrazioni a mano prima del primo deploy:
  ```bash
  DATABASE_URL="postgresql://..." npx prisma migrate deploy
  ```
- **Opzione B**: Aggiungere uno script di build che esegue `prisma generate` (già implicito se usi `postinstall` o build) e eseguire `prisma migrate deploy` in un job CI (es. GitHub Actions) prima del deploy, oppure una volta a mano dopo il primo deploy.

Dopo il primo deploy, assicurati che lo schema sia applicato (es. `npx prisma migrate deploy` con la `DATABASE_URL` di produzione).

## 7. Seed (opzionale)

Per creare utenti e client iniziali in produzione:

```bash
DATABASE_URL="<prod-url>" npm run db:seed
```

Esegui da locale con la `DATABASE_URL` di produzione, oppure da uno script one-off (non in ogni deploy).

## 8. Verifiche pre-deploy

- [ ] `npm run build` completa senza errori.
- [ ] `npm run lint` senza errori.
- [ ] `npm run test` passa.
- [ ] `.env` non è nel repository.
- [ ] In produzione sono impostate: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.

## 9. Dopo il deploy

- Apri l’URL dell’app (es. `https://xxx.vercel.app`); dovresti essere reindirizzato a `/login`.
- Accedi con un utente seed (se hai eseguito il seed).
- Verifica creazione di un post con upload: i file devono essere salvati su S3/R2 e le immagini devono essere visibili (URL assoluti da S3/R2 o da `S3_PUBLIC_URL`).

## Riepilogo

Il progetto è pronto per Vercel se:

1. **Database**: PostgreSQL con URL (preferibilmente pooled) in `DATABASE_URL`.
2. **Storage**: S3 o R2 configurato in produzione; senza non è possibile caricare file.
3. **Auth**: `NEXTAUTH_URL` e `NEXTAUTH_SECRET` impostati.
4. **Migrazioni**: schema applicato con `prisma migrate deploy` (o equivalente) sull’DB di produzione.
5. **Build**: `next build` e lint/test passano in locale.

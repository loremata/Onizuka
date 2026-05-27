# Onizuka

Onizuka e il sistema operativo intelligente personale, aziendale e commerciale di Lorenzo Matarazzo.

Questa codebase nasce da un portale multi-tenant di approvazione contenuti e viene evoluta in una piattaforma unica con moduli integrati (Core, CRM, Flow, Memory, Audit, Reach, Finance, Insights).

## Regola di naming

- **Onizuka** = BOS interno (questa codebase).
- **Online Station** = contenitore aziendale/commerciale.
- I **brand verticali** (LabSeven, StudioPop, …) sono asset commerciali, non moduli UI.
- Vietati in UI: StationHQ, SINFONIA, DRAKKAR, OPERA, SKALD, OUVERTURE, MAESTRO.

Strategia: [docs/PUNTO-SITUA-DEFINITIVO.md](./docs/PUNTO-SITUA-DEFINITIVO.md)

## Deploy e documentazione

| Cosa | Dove |
|------|------|
| **Checklist ops** | **[PASSI-MANCANTI.md](./PASSI-MANCANTI.md)** · live `/admin/go-live` |
| **Indice doc** | **[docs/README.md](./docs/README.md)** |
| **Deploy tecnico** | [docs/DEPLOY.md](./docs/DEPLOY.md) |

```bash
npm run passi-mancanti:full    # verifica locale
npm run passi-mancanti:prod    # env + smoke produzione
```

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + shadcn-style UI components
- **PostgreSQL** + Prisma ORM
- **Auth:** NextAuth (Auth.js) with Credentials provider
- **File storage:** S3-compatible abstraction (Step 3); local filesystem fallback for dev

## Step 1: Project scaffold, DB, auth, role-based routing

- Prisma schema: `User`, `Client`, `PostItem`, `MediaAsset`, `Comment`, `WebhookSubscription`
- NextAuth with Credentials + bcrypt; JWT session with `role` and `clientId`
- Role-based routing: **Admin** → `/admin/*`, **Client** → `/app/*`
- Login at `/login`; root `/` redirects to `/admin` or `/app` by role

## Step 2: Admin CRUD (clients, users)

- **Clients** (`/admin/clients`): List all clients; create (company name, slug, contact email); edit; delete with confirmation. Slug auto-generated from company name if left blank; must be unique.
- **Users** (`/admin/users`): List all users with role and client; create user (email, name, password, role Admin/Client, client required for Client role); reset password via `/admin/users/[id]/reset-password`.
- All mutations use server actions; delete client uses API route for confirmation flow. Admin-only enforced server-side in actions and API.

## Step 3: Post creation + media upload

- **Storage:** `src/lib/storage.ts` abstracts S3-compatible (R2 / AWS S3) and local filesystem. Set `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (and optional `S3_ENDPOINT`, `S3_REGION`, `S3_PUBLIC_URL`) for S3; otherwise files are stored in `.uploads` (or `UPLOADS_DIR`) and served via `GET /api/uploads/[...path]`.
- **New post** (`/admin/posts/new`): Form with client, platform (Facebook, Instagram, LinkedIn, GBP), caption, optional scheduled date, and multiple media (images/videos). Creates `PostItem` and `MediaAsset` records; files uploaded through the storage abstraction.
- **Posts list** (`/admin/posts`): Table with filters by client, platform, status; link to new post and to view each post.
- **Post detail** (`/admin/posts/[id]`): Read-only view of caption, scheduled date, media, and comments. Admin can set status back to **Pending** after edits (comments history kept).

## Step 4: Client approval UI + comments

- **Client list** (`/app`): Cards for the current client’s posts only (tenant isolation). Filters by platform and status. First media thumbnail and caption preview per card; link to detail.
- **Client post detail** (`/app/posts/[id]`): Media, caption, scheduled date, and **activity/comments** (created date, updated date, all comments with author and time). Actions (only when status is Pending):
  - **Approve**: sets status to Approved; optional comment.
  - **Request changes**: sets status to Needs revision; **comment required**.
- **Admin**: On admin post detail, comments are shown and a **Set back to Pending** button appears when status is not Pending so the agency can re-submit after edits.
- All client actions enforce `post.clientId === session.user.clientId` server-side.

## Step 5: n8n integration (webhooks + API)

- **Schema:** `PostItem` has optional `publishedAt` and `externalRef` (set when n8n marks a post as published). Run `npx prisma migrate dev` (or `db push`) after pulling.
- **Auth:** Set `N8N_API_KEY` in env. All n8n API routes require `X-API-Key: <key>` or `Authorization: Bearer <key>`.
- **GET /api/n8n/approved?clientSlug=...&platform=...**  
  Returns approved posts for that client (by slug). Optional `platform` filter (FACEBOOK, INSTAGRAM, LINKEDIN, GBP). Each item includes `postItemId`, `clientId`, `clientSlug`, `platform`, `captionText`, `mediaUrls` (absolute), `scheduledFor`, `publishedAt`, `externalRef`, `updatedAt`.
- **POST /api/n8n/mark-published**  
  Body: `{ postItemId, publishedAt?, externalRef? }`. Sets `publishedAt` (default now) and optional `externalRef` on the post.
- **Webhooks:** When a post becomes **Approved** or **Needs revision**, the app POSTs to each active **WebhookSubscription** (Admin → Webhooks). Payload: `event`, `clientId`, `clientSlug`, `postItemId`, `status`, `platform`, `captionText`, `mediaUrls`, `updatedAt`, `timestamp` (Unix), `signature`. **Signature:** HMAC-SHA256 with the subscription’s secret over the JSON body *without* the `signature` field (so receiver parses body, removes `signature`, stringifies, then verifies HMAC). Use `timestamp` for replay protection (e.g. reject if too old).
- **Admin → Webhooks:** Add subscriptions (event, optional client, target URL, secret), activate/deactivate.

### Connecting n8n

1. **Polling approved posts:** In n8n, add an HTTP Request node (or schedule + HTTP Request): GET `https://your-app.com/api/n8n/approved?clientSlug=demo-client`, header `X-API-Key: your-N8N_API_KEY`. Process `items` and publish to social; then call **mark-published** with `postItemId` and optional `externalRef`.
2. **Webhook (real-time):** In n8n, create a Webhook node and copy its URL. In the portal, Admin → Webhooks → Add subscription: event **POST_APPROVED**, target URL = your n8n webhook URL, secret = a shared secret. In n8n, verify the request: parse body, remove `signature`, compute HMAC-SHA256(secret, JSON.stringify(rest)), compare to `signature`; optionally reject if `timestamp` is too old. Then run your publish workflow and call **mark-published**.

## Step 6: Polish, rate limiting, tests

- **Rate limiting:** Login: POST `/api/auth/signin` is limited to 10 attempts per IP per minute (middleware). n8n API: GET `/api/n8n/approved` and POST `/api/n8n/mark-published` are limited to 120 requests per identifier (API key or IP) per minute; 429 with `Retry-After` when exceeded.
- **UI:** Shared `StatusBadge` (Pending / Approved / Needs revision) with consistent colors; client post cards use it and have touch-friendly tap targets; layout uses `min-h-screen`, `antialiased`, and responsive grids.
- **Access control tests:** `npm run test` runs Jest tests in `src/__tests__/access-control.test.ts` that mock session and prisma to assert: client cannot approve or request changes on another client’s post (returns “Post not found”); unauthorized or missing comment returns the right errors; successful approve when post belongs to client.

## Setup

### Avvio rapido (sviluppo locale)

1. **Requisiti:** Node.js 18+, PostgreSQL in esecuzione.
2. **Dipendenze:** `npm install`
3. **Ambiente:** copia `.env.example` in `.env` e imposta almeno:
  - `DATABASE_URL` (es. `postgresql://user:password@localhost:5432/onizuka?schema=public`)
   - `NEXTAUTH_URL=http://localhost:3000`
   - `NEXTAUTH_SECRET` (es. genera con `openssl rand -base64 32`)
4. **Database:** `npx prisma migrate dev --name init` poi `npm run db:seed`
5. **Avvio:** `npm run dev` → [http://localhost:3000](http://localhost:3000) (redirect a `/login`).

In sviluppo **non** serve configurare S3: i file vanno in `.uploads` e sono serviti da `/api/uploads/`.

---

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and set:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/onizuka?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"   # e.g. openssl rand -base64 32
```

### 3. Database

```bash
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed
```

### 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`.

### Seed users (Step 1)

| Role   | Email                 | Password   |
|--------|------------------------|------------|
| Admin  | admin@agency.com       | admin123   |
| Client | client@democlient.com  | client123  |

- **Admin** sees `/admin` (dashboard, Clients, Users, Posts, Webhooks).
- **Client** sees `/app` (posts for their workspace only; approve or request changes).

## Project structure

```
src/
  app/
    (auth)/login/        # Public login
    admin/               # Admin layout + dashboard, clients, users, posts
    app/                 # Client layout + posts (tenant-scoped)
    api/auth/[...nextauth]/
  components/
    ui/                  # Button, Input, Card
    providers.tsx        # SessionProvider
  lib/
    auth.ts              # NextAuth config, session types
    prisma.ts            # Prisma client singleton
    utils.ts             # cn()
  middleware.ts          # Protects /admin and /app by role
prisma/
  schema.prisma
  seed.ts
```

## Running tests

```bash
npm run test
```

## Deploy su Vercel

Vedi **[docs/DEPLOY.md](./docs/DEPLOY.md)** e **[PASSI-MANCANTI.md](./PASSI-MANCANTI.md)**.

# Rubis Enjoy — Stock & Reorder

A multi-user web app for tracking Rubis Enjoy retail stock across ~75 Kenyan branches, supplied by
Pure Nutrition (Je & Jo Nutbar). It replaces a single-file prototype that stored everything in the
browser, and moves all data into a shared PostgreSQL database so merchandisers, branch managers,
Rubis Head Office and Pure Nutrition management all see the same numbers.

## What it does

Four roles, each with its own shared access code:

| Role | What they do |
| --- | --- |
| **Merchandiser** | Visit any branch, submit a full stocktake (per-SKU counts, display checks, competitor check, photos, signature), or log a delivery/sale/return/write-off. |
| **Branch Manager** | See their own branch's reorder list and approval status, run a quick self-service stocktake, log movements, read Head Office announcements, check the delivery calendar. |
| **Rubis HQ** | Send announcements to all branches, a county, all COCO/CODO branches, or one branch. |
| **Pure Nutrition Manager** | Full dashboard — KPIs, reorder value by county, order summary with approvals, production plan, alerts, delivery calendar, branch and product admin, and access-code management. |

### Core business rules

- **Stock position** is derived, never stored: the branch's latest stocktake seeds each SKU, then
  every movement dated on or after that stocktake is replayed forward
  (Delivery `+`, Sale `−`, Return `+`, Expired/Damaged `−`).
- `current = max(0, shelf) + max(0, back stock)`.
- **Every branch must hold at least 6 units of every SKU** (`MIN_STOCK`), regardless of the target
  set in the Products tab. A target below 6 is still floored to 6 in the reorder calculation.
- `reorder = unavailable ? 0 : max(0, max(target, 6) − current)` — products that aren't currently
  made are excluded from all reorder recommendations, the Order Summary and the Production Plan.
- **Delivery** is a fixed countrywide run on the **23rd of every month**.
- On the **last day of the month**, branches that haven't counted today get a red prompt, and an
  automated Head Office reminder is posted once per month.

The reorder logic lives in `lib/stock.ts` and is covered by unit tests (`lib/stock.test.ts`).

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma ORM · PostgreSQL ·
lucide-react · recharts · `jose` (session cookie) · `bcryptjs` (access-code hashing) ·
`@vercel/blob` (photo/signature storage) · Vitest.

---

## Local development

### Prerequisites

- Node.js 20+ (this project was built and tested on Node 24)
- A PostgreSQL database (see the two options below)

### 1. Install

```bash
npm install
```

### 2. Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env
```

Both Next.js and the Prisma CLI read `.env`. (Next.js also reads `.env.local` if you prefer to keep
it there — but the Prisma CLI only reads `.env`, so keep `DATABASE_URL` in `.env`.)

| Variable | Required | What it's for |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `SESSION_SECRET` | yes | Signs the `rubis_session` JWT cookie. Use 32+ random characters: `openssl rand -base64 32`. |
| `BLOB_READ_WRITE_TOKEN` | production only | Vercel Blob token for photo/signature uploads. Leave unset locally — uploads then fall back to a gitignored `./.local-uploads/` directory served by an internal route. |

Both `.env` and `.env.local` are gitignored. Never commit them.

### 3. Get a database running

**Option A — a hosted Postgres (recommended, matches production).**
Create a free Neon or Supabase database (see the deploy guide below), paste its connection string
into `DATABASE_URL`, and skip to step 4.

**Option B — no Docker, no local Postgres installed.**
This repo ships a zero-install local Postgres for development, backed by PGlite. In its own
terminal:

```bash
npm run dev:db
```

It prints the `DATABASE_URL` to use (it listens on `127.0.0.1:5433`). Data persists in a gitignored
`./.pgdata/` directory. Leave it running while you work.

> This local server is a development convenience only — it is never part of the deployment story.
> Two notes if you use it: append `?sslmode=disable&connection_limit=1&pgbouncer=true` to the
> connection string, and use `npx prisma migrate deploy` rather than `migrate dev` (it can't host
> the shadow database that `migrate dev` creates).

### 4. Create the schema and seed it

```bash
npx prisma migrate deploy   # apply migrations
npx prisma db seed          # 18 products, 75 branches, 3 default role codes
```

### 5. Run it

```bash
npm run dev
```

Open http://localhost:3000.

### Default access codes (change these immediately)

| Role | Code |
| --- | --- |
| Merchandiser (shared backup code) | `PURE2026` |
| Pure Nutrition Manager | `RUBIS-ADMIN` |
| Rubis HQ | `RUBIS-HQ` |
| Branch Manager | `RB` + zero-padded branch id — e.g. branch 4 is `RB004` |

Rotate the three shared codes from **Manager → Team Access** as soon as the app is live. Codes are
stored only as bcrypt hashes, so they're never readable from the database.

### Other commands

```bash
npm run build       # production build (runs prisma generate first)
npm run typecheck   # tsc --noEmit
npm test            # vitest — unit tests for the reorder/leaderboard logic
```

---

## Deploying to Vercel + Neon + Vercel Blob

This walkthrough assumes you've never deployed anything before. Budget about 30 minutes. Everything
below has a free tier.

### Step 1 — Put the code on GitHub

1. Create an account at https://github.com if you don't have one.
2. Create a new **empty private repository** — call it `rubis-stock-app`. Don't add a README,
   `.gitignore`, or licence; the repo already has them.
3. In a terminal, from this project folder:

```bash
git add .
git commit -m "Rubis Enjoy stock and reorder app"
git branch -M main
git remote add origin https://github.com/<your-username>/rubis-stock-app.git
git push -u origin main
```

Double-check that `.env` did **not** get uploaded — it's in `.gitignore`, so it shouldn't be there.

### Step 2 — Create the database (Neon)

1. Go to https://neon.com and sign up (you can use your GitHub account).
2. Click **Create project**. Name it `rubis-stock`, pick the region closest to Kenya —
   **AWS eu-central-1 (Frankfurt)** is usually the best latency — and click Create.
3. On the project dashboard, find **Connection string** and click **Copy snippet**. It looks like:
   ```
   postgresql://neondb_owner:XXXXXXXX@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this somewhere safe for a minute — it's the value of `DATABASE_URL`.
   Make sure you copy the **pooled** connection string (Neon shows a "Pooled connection" toggle —
   leave it on; it's the right choice for a serverless app like this).

> Prefer Supabase? Same idea: create a project at https://supabase.com, then
> **Project Settings → Database → Connection string → URI**, and use the **Transaction pooler**
> string (port 6543). Replace `[YOUR-PASSWORD]` with the database password you set at project
> creation.

### Step 3 — Create the Vercel project

1. Go to https://vercel.com and sign up with the same GitHub account.
2. Click **Add New… → Project**, find `rubis-stock-app` in the list and click **Import**.
3. Vercel will detect Next.js automatically. **Don't deploy yet** — first open
   **Environment Variables** on that same screen and add:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon connection string from step 2 |
   | `SESSION_SECRET` | a long random string — run `openssl rand -base64 32` in a terminal and paste the output |

   Add both to **all three** environments (Production, Preview, Development).
4. Now click **Deploy**. The first build takes a couple of minutes.

### Step 4 — Attach a Blob store for photos and signatures

1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database → Blob**, name it `rubis-photos`, and create it.
3. When prompted, **connect it to this project** and select all environments.

That's it — Vercel injects `BLOB_READ_WRITE_TOKEN` into the project automatically. You never copy
this token by hand. The app checks for it at runtime: when it's present, photos go to Blob storage;
when it isn't (i.e. local dev), they fall back to a local directory.

4. **Redeploy** so the new variable is picked up: **Deployments → ⋯ on the latest → Redeploy**.

### Step 5 — Create the tables in the production database

The build does not touch your database, so run the migration once from your own machine, pointed at
production:

```bash
DATABASE_URL="<your Neon connection string>" npx prisma migrate deploy
```

If Neon gave you a separate **direct** (non-pooled) connection string, use that one here — migrations
prefer a direct connection. Either usually works.

### Step 6 — Seed the production data, once

```bash
DATABASE_URL="<your Neon connection string>" npx prisma db seed
```

This inserts the 18 products, the 75 branches, and the three default role codes, then prints them.

**Re-running the seed is safe.** Every write is an upsert whose update clause does nothing, so
existing rows are left exactly as they are — a second run will not reset a rotated access code,
overwrite a manager-tuned target, wipe a branch's contact details, or duplicate anything. It only
fills in rows that are genuinely missing.

### Step 7 — Lock it down

1. Open your live URL (Vercel shows it on the project page).
2. Go to **Pure Nutrition Manager**, sign in with `RUBIS-ADMIN`.
3. Open **Team Access** and immediately set new values for:
   - Manager Access Code
   - Rubis HQ Access Code
   - Backup Team Code (the merchandiser fallback)
4. Add each merchandiser by name to generate their personal `MC-XXXX` code. **Write it down when it
   appears** — codes are hashed, so each one is shown exactly once, right after it's created. If one
   is lost, use **Regenerate**.
5. Send each branch manager only their own branch code (the `RB0xx` list is in the same tab).

### Step 8 — Ongoing

- **Deploying changes:** push to `main` on GitHub; Vercel rebuilds and deploys automatically.
- **Schema changes:** create the migration locally with `npx prisma migrate dev --name <what-changed>`
  against a hosted database, commit the generated folder in `prisma/migrations/`, push, then run
  `DATABASE_URL="…" npx prisma migrate deploy` against production.
- **Backups:** Manager → Team Access → **Download Backup** saves a full JSON export of every branch,
  product, stocktake, movement and message. Access codes are never included. Restoring is additive —
  it merges the file back in inside a single transaction and won't delete or duplicate anything.
  Neon and Supabase also take their own automatic backups.
- **Custom domain:** Vercel project → **Settings → Domains → Add**, then follow the DNS instructions.

---

## How the pieces fit together

```
app/
  page.tsx                  home screen — the four role cards
  merchandiser|branch|
  manager|hq/page.tsx       server components: check the session, then render either that
                            role's login screen or its dashboard
  actions/                  server actions — every mutation, each re-checking the session
  api/upload/route.ts       receives a compressed photo/signature, stores it, returns a URL
  api/backup/route.ts       manager-only JSON export
  local-uploads/[...path]   serves locally-stored uploads in development
middleware.ts               edge guard: blocks unauthenticated API calls, drops dead cookies
lib/
  stock.ts                  the reorder maths (pure, unit-tested)
  queries.ts                all reads, and the DTOs the UI renders
  session.ts                signed httpOnly cookie via jose
  storage.ts                uploadFile() — Vercel Blob, or a local directory in dev
  backup.ts                 export shape + validation
  brand.ts                  brand colours and the three logos
components/                 the UI, grouped by role
prisma/                     schema, migrations, seed
```

### Security model

- Codes are shared per role (this is intentional — it matches how the team actually works) but every
  code is verified **server-side** against a bcrypt hash. Nothing is ever compared in the browser.
- Signing in sets a signed, httpOnly `rubis_session` cookie (30 days, `sameSite=lax`, `secure` in
  production) carrying only the role and, where relevant, the branch id and merchandiser name.
- Every page, server action and API route independently re-checks the session and role. A branch
  manager's session is scoped to their own branch — they cannot read or write another branch's data
  even by crafting a request.
- Backups deliberately contain no codes or hashes.

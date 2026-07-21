# Deployment

This is a runbook for a human to follow — Claude does not have access to your
Railway or Vercel accounts, so nothing here was run automatically. Do these
steps yourself, in order.

Target architecture:

- **Backend + PostgreSQL** → Railway (one project, two services: the NestJS
  app and a Postgres plugin).
- **Frontend** → Vercel.
- The frontend never talks to the backend directly from the browser — it
  proxies through Next.js's own `/api/:path*` rewrite (`frontend/next.config.ts`),
  which runs server-side on Vercel. That means **no CORS configuration is
  needed on the backend**, in production or locally.

This is a monorepo with no workspace tooling (see `CLAUDE.md`), so both
platforms need to be told each app's subdirectory is its own project root —
that's called out explicitly below.

---

## Part 1 — Railway (backend + PostgreSQL)

### 1.1 Create the project and database

1. Go to [railway.app](https://railway.app) and create a new project.
2. In the project, click **New → Database → Add PostgreSQL**. Railway
   provisions a Postgres instance and its own `DATABASE_URL` — you don't set
   this one yourself.

### 1.2 Add the backend service

1. In the same project, click **New → GitHub Repo** and select this repo
   (connect Railway to GitHub first if you haven't).
2. Once the service is created, open its **Settings** tab:
   - **Root Directory**: set to `backend`. This repo has no root-level
     `package.json`, so Railway must be told the backend's subdirectory is
     the build context — this also scopes Railway's auto-discovery of
     `backend/railway.json` (already committed, see below) to that
     directory.
   - **Builder**: leave as Nixpacks (default) — `railway.json` pins it
     explicitly.
3. `backend/railway.json` already configures the rest:
   - **Build command**: `npm run build` (→ `nest build`).
   - **Start command**: `npx prisma migrate deploy && npm run start:prod`.
     `prisma migrate deploy` applies any pending migrations against the
     production database *every deploy*, before the app starts serving
     traffic. It only runs migrations that haven't been applied yet, so
     re-deploys with no new migrations are a fast no-op. This is the only
     place migrations run automatically.
   - **Health check**: `/health` (see `backend/src/health/health.controller.ts`).
   - `npm run build`'s `postinstall` hook (`prisma generate`, added to
     `backend/package.json`) regenerates the Prisma Client during the
     install phase, since `generated/prisma` is gitignored and won't exist
     in a fresh clone/build.

### 1.3 Env vars

Open the backend service's **Variables** tab and add:

| Variable       | Value                                                                 |
| -------------- | ---------------------------------------------------------------------|
| `DATABASE_URL` | Reference variable: `${{Postgres.DATABASE_URL}}` (pick your Postgres service's actual name from the dropdown Railway shows when you type `${{`) |

Do **not** set `PORT` — Railway injects it automatically, and
`backend/src/main.ts` already reads `process.env.PORT` and binds to
`0.0.0.0` (required for Railway's container networking to reach it).

### 1.4 Deploy and verify

1. Trigger a deploy (pushing to the connected branch does this
   automatically; otherwise use **Deploy** in the Railway dashboard).
2. Watch the deploy logs for the `prisma migrate deploy` step to confirm
   migrations applied cleanly.
3. Once live, open **Settings → Networking** and generate a public domain
   if one isn't already assigned (e.g. `your-service.up.railway.app`).
4. Confirm it's up: `curl https://your-service.up.railway.app/health` should
   return `{"status":"ok",...}`.

### 1.5 Seed data — manual, one-time only

The seed script (`backend/prisma/seed.ts`, `npm run seed`) is **not** wired
into the build or start command anywhere — it must stay a deliberate,
manual step, not something that runs on every deploy (it wipes and
re-inserts all `Employee`/`SalaryRecord` rows — see the idempotency note in
`CLAUDE.md`'s decision log — you do not want that firing on a routine
re-deploy of a live database).

To populate the deployed database with the same 10,000-employee demo
dataset used locally, run it from your machine against the production
database using the [Railway CLI](https://docs.railway.com/guides/cli):

```
railway login
railway link            # select this project/service when prompted
cd backend
railway run npm run seed
```

`railway run` executes the command locally but injects the linked service's
env vars (`DATABASE_URL`) into the process, so the script connects to the
real Railway Postgres instance instead of your local one. Run this once,
after the first successful deploy.

---

## Part 2 — Vercel (frontend)

### 2.1 No `vercel.json` needed

Nothing in `frontend/next.config.ts` requires Vercel-specific config — it's
a standard App Router project (rewrites, no custom headers/redirects logic
that needs platform-specific handling), so Vercel's zero-config Next.js
build (auto-detected framework preset) works out of the box. A `vercel.json`
was deliberately **not** added — it would just duplicate what the preset
already infers.

### 2.2 Import the project

1. Go to [vercel.com](https://vercel.com/new) and import this repo.
2. In the import screen's **Root Directory** setting, choose `frontend`
   (same reasoning as Railway's Root Directory above — this repo has no
   root-level `package.json`).
3. Framework preset should auto-detect as **Next.js**. Leave build/output
   settings at their defaults.

### 2.3 Env vars

In the project's **Settings → Environment Variables**, add:

| Variable      | Value                                                          | Environments |
| ------------- | --------------------------------------------------------------| ------------ |
| `BACKEND_URL` | Your Railway backend's public URL from step 1.4, e.g. `https://your-service.up.railway.app` (no trailing slash) | Production, Preview |

This is the one and only env var the frontend needs (see
`frontend/.env.example`). It's read only in `next.config.ts` at request
time on the server, so it's a plain env var, not `NEXT_PUBLIC_` — it's
never sent to the browser.

If you want Preview deployments (PRs) to hit a separate staging backend
instead of production, set a different value scoped to the Preview
environment only.

### 2.4 Deploy and verify

1. Deploy. Vercel builds with `next build` and serves via its managed
   Next.js runtime.
2. Open the deployed URL, confirm `/employees` loads real data — this
   proves the `/api/:path*` rewrite is correctly reaching the Railway
   backend (a `BACKEND_URL` typo or missing trailing-slash mismatch
   usually shows up here as a fetch failure on that page, not a build
   error, since it's only evaluated at request time).

---

## Environment variable reference

### Backend (Railway) — `backend/.env.example`

| Variable       | Required | Set by                                    |
| -------------- | -------- | ------------------------------------------|
| `DATABASE_URL` | Yes      | You (reference the Postgres plugin's variable) |
| `PORT`         | No       | Railway (injected automatically — don't set manually in production; only used from `.env` for local dev) |

### Frontend (Vercel) — `frontend/.env.example`

| Variable      | Required | Set by |
| ------------- | -------- | ------ |
| `BACKEND_URL` | Yes      | You (the deployed Railway backend's public URL) |

# AI Usage

This project was built with Claude Code throughout. This document reconstructs, phase
by phase, what Claude Code was actually directed to do, based on the working session
log kept in `CLAUDE.md`'s Decision Log (the project's persistent memory, re-read at
the start of every session). It is not a verbatim chat transcript — no full prompt
history was retained separately from that log — but every item below corresponds to a
real decision/outcome recorded there, not a hypothetical.

## Phase 1 — Scaffolding & data model (`new: created backend and frontend`, `Initial commit`)

- Scaffold a monorepo with a NestJS + TypeScript + Prisma + PostgreSQL backend and a
  Next.js (App Router) + TypeScript + Tailwind + shadcn/ui frontend, as two
  independent apps in one git repo (no workspace tooling).
- Design the `Employee`/`SalaryRecord` Prisma schema so that salary changes are an
  append-only history table, not mutable fields on `Employee` — needed to answer
  trend/history questions later, not just current state.
- Set the `SalaryRecord.employeeId` FK to `onDelete: Restrict` rather than `Cascade`,
  so an employee with salary history can't be hard-deleted.
- Create the `employees`/`salaries` NestJS modules empty (structure only, no
  controllers/services yet) ahead of the scope doc being finalized.
- Diagnose and fix a Prisma 7 `prisma-client` generator issue: it needs an explicit
  driver adapter (`@prisma/adapter-pg`) for Postgres, and defaulted to ESM output
  (`import.meta.url`) that crashed `nest build`/`node dist/main` until
  `moduleFormat = "cjs"` was pinned in the generator block.
- Write `backend/prisma/seed.ts` to generate 10,000 employees across 5 countries
  with realistic, country/department-appropriate salary bands and 2-4 salary-history
  records each, using `@faker-js/faker`, made idempotent and byte-for-byte
  deterministic via a fixed `faker.seed()` and wipe-then-reseed — including tracking
  down a desync bug caused by one branch using unseeded `Math.random()`.
- Add a shared, `@Global()` `PrismaService`/`PrismaModule`.
- Diagnose a `SASL: SCRAM-SERVER-FIRST-MESSAGE` crash on first real query: `main.ts`
  wasn't loading `.env` the way `prisma.config.ts`/`seed.ts` did, so
  `DATABASE_URL` was `undefined` under normal `npm run start`. Fix: load `dotenv/
  config` first in `main.ts`, and make `PrismaService` throw a clear error
  immediately if `DATABASE_URL` is still unset.

## Phase 2 — Backend APIs & tests (`feat: employees API, salary history API, analytics API + tests`)

- Build the `employees` module: paginated/filterable `GET /employees` (department,
  country, status, name search), `GET /employees/:id` (with salary history),
  `POST`/`PATCH /employees/:id`, and a `DELETE /employees/:id` that does a
  **soft-delete** (`status: TERMINATED`) rather than removing the row — chosen to
  align with the FK `Restrict` decision. Validate all DTOs with `class-validator`
  behind a global `ValidationPipe`. Write Jest unit tests against a mocked
  `PrismaService` (17 tests, no real DB).
- Build the `analytics` module (`GET /analytics/summary`): headcount, avg/median
  salary by department and by country, total payroll cost, and a salary
  distribution histogram. Decide to use each employee's most-recent `SalaryRecord`
  (via raw `DISTINCT ON`) as "current salary" and exclude `TERMINATED` employees, so
  headcount/payroll aren't overstated. Decide against any FX conversion — segment
  every stat by currency instead and bucket the distribution by compa-ratio (salary
  ÷ median of the same currency) so pay position is comparable across currencies
  without converting. Write 7 Jest unit tests against a hand-computed fixture
  dataset (mocked `$queryRaw`, no real DB).
- Build the first `salaries` write endpoint, `POST /employees/:employeeId/salaries`,
  nested under `/employees/:id` to match the read shape. Decide `currency` should
  never be client-supplied — the service derives it from the parent employee — since
  analytics' currency segmentation silently depends on `SalaryRecord.currency`
  always matching `Employee.currency`. Make the endpoint insert-only (no update/
  delete), enforcing append-only history at the API level. Write 3 Jest unit tests.

## Phase 3 — Employee list page (`feat: employee list page with search, filter, pagination, layout and navigation shell`)

- Discover this Next.js install (16.2.10) diverges from training data: `params`/
  `searchParams` are `Promise`s requiring `await`, and the shadcn setup here is a
  `@base-ui/react` fork, not Radix — `Button` has no `asChild`, requiring a
  `render={<Link .../>}` prop pattern instead.
- Hand-build the app shell (`AppShell`/`Sidebar`/`Topbar` — persistent nav, mobile
  hamburger toggle, active-route highlighting) rather than use the shadcn CLI's
  sidebar block, since that block assumes Radix-style patterns this fork doesn't
  support and the shell itself was simple enough to hand-roll.
- Add a Next.js rewrite (`/api/:path*` → backend) instead of enabling CORS or
  hardcoding an absolute backend URL in client fetches, to keep the browser
  same-origin and the backend URL out of client bundles.
- Build `/employees` on TanStack Table + TanStack Query rather than plain
  `useEffect`/`fetch`, for request de-duping, in-flight cancellation, and
  `keepPreviousData` to avoid a flash-to-empty on page/filter changes.
- Decide department/country/status filters should be a fixed list mirrored from the
  seed script rather than fetched from a distinct-values endpoint that doesn't
  exist yet, and that filter dropdowns should be styled native `<select>`s rather
  than a composed base-ui `Select`, for free keyboard/a11y support and simpler RTL
  testing on an unfamiliar fork.
- Set up Vitest + React Testing Library (chosen over Jest for native Vite
  integration and `@/*` alias resolution via `resolve.tsconfigPaths`); explicitly
  wire `cleanup()` into `afterEach` since `vitest.config.ts` doesn't set
  `test.globals: true`.
- Verify the table end-to-end against the real seeded backend (10,001 rows) with
  Playwright driving system Chrome, after the bundled Chromium revision didn't
  match what the installed `playwright` package expected.

## Phase 4 — Employee detail page (`feat: employee detail page with salary history`)

- Build `/employees/[id]` (`EmployeeDetail`/`SalaryHistory`) using the same
  `useQuery`/`isPending`/`isError` pattern as `EmployeesTable`, rather than an async
  Server Component + Next's `notFound()` convention, to keep every data-fetching
  page in the app on one consistent, already-tested pattern. Distinguish "employee
  doesn't exist" (404) from other failures via a small `ApiError` class carrying
  the HTTP status.
- Decide the employee-name heading should be `<h2>`, not `<h1>`, since `Topbar`
  already renders the page's `<h1>`; `SalaryHistory`'s heading nests as `<h3>`.
- Find and fix a real bug while browser-testing: base-ui's own docs say `<a>`/
  `next/link` should never be composed via `Button`'s `render` prop at all (link
  semantics, not button semantics) — this contradicted the Phase 3 pattern.
  Fix both the new not-found state and the pre-existing `not-found.tsx` usage to
  render `<Link className={buttonVariants({...})}>` directly.
- Pin `formatDate`/`formatAmount` to `"en-US"` explicitly rather than the viewer's
  locale, both so different HR staff see identical formatting regardless of their
  OS locale, and to make Vitest date assertions deterministic (the test runner's
  default ICU locale formats differently).
- Build `/analytics` on Recharts, chosen as the ecosystem default matching the
  app's existing small/typed/composable component style; populate the previously
  unused `--chart-1` token with a validated categorical color via the project's
  dataviz skill's palette validator.
- Work through, with the user, how to chart `byDepartment` vs. `byCountry` data
  given no shared currency axis is viable across 5 currencies of very different
  magnitude: facet department into one small chart per currency (every department
  has all 5 currencies); for country (one currency per country in this seed), ask
  the user how to handle it rather than guess, and land on a single bar chart with
  every bar direct-labeled in its own currency, axis ticks hidden, plus a
  disclaimer caption — rather than faceting into single-bar "charts."
- Add a shared `frontend/src/lib/format.ts` once the same currency/date formatting
  was needed a fifth and sixth time across the analytics dashboard.
- Hand-roll `ui/card.tsx` rather than invoke the shadcn CLI, since Card has no
  interactive primitive and matching the existing inline convention was simpler.

## Phase 5 — Polish pass (`chore(frontend): error boundaries, loading and empty state audit`)

- Audit the frontend for unhandled error/loading/empty states across `/employees`,
  `/employees/[id]`, `/analytics`, `/settings`.
- Add per-route `error.tsx` boundaries (one shared `page-error.tsx`) rather than a
  single root `app/error.tsx`, so a crash on one page doesn't unmount the whole
  `AppShell` and strand navigation.
- Add a "Retry" action (`query.refetch()`) to every inline TanStack Query error
  state that previously had no way to recover short of a manual reload.
- Track down and fix a responsive bug found during a mobile audit: `AppShell`'s
  flex column had no `min-w-0`, so the employees table's wide content pushed the
  whole page wider than the viewport instead of scrolling in its own container.
  Verify the fix with Playwright at a 375px viewport against the real backend.

## Phase 6 — Deployment prep (`chore: prepare backend and frontend for Railway/Vercel deployment`)

- Choose Railway (backend + Postgres) and Vercel (frontend) as deploy targets,
  matching the existing two-independent-apps structure — set each platform's Root
  Directory instead of adopting workspace tooling.
- Configure `backend/railway.json` to chain `prisma migrate deploy` in front of the
  start command (Railway has no separate release-phase concept), and deliberately
  leave `prisma db seed` out of that chain since it wipes and re-inserts all rows —
  documented instead as a manual one-time `railway run npm run seed` step.
- Add `postinstall: prisma generate` to `backend/package.json` since
  `generated/prisma` is gitignored and a fresh `npm ci` would otherwise have no
  Prisma Client.
- Bind `main.ts`'s listener to `0.0.0.0` explicitly for container networking.
- Decide no `vercel.json` is needed — the zero-config Next.js App Router preset
  covers everything already in `next.config.ts`.
- Fix `frontend/.gitignore` silently matching `.env.example` (inherited from
  `create-next-app`'s `.env*` pattern) by adding a `!.env.example` negation.
- Write the full deployment runbook ([deployment.md](deployment.md)) with exact
  dashboard fields to set, since Claude has no account access to configure hosting
  dashboards itself.

## Ongoing

Every phase above was driven from `CLAUDE.md` as persistent project memory — each
session starts by re-reading it, and every non-obvious decision (and the reasoning
behind it) is appended to its Decision Log before moving on, so later sessions don't
have to rediscover the same trade-offs.

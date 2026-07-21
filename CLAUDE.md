# Employee Salary Management — Project Memory

This file is the persistent memory for this project. Re-read it at the start of every
session before doing anything else — conversation context does not carry over between
sessions.

## Project Summary

Web-based employee salary management software for ACME org's HR team, built as part of
a take-home engineering assessment. Replaces the current Excel-based workflow for
managing salary data across 10,000 employees in multiple countries. Primary user is the
HR Manager, who needs to manage salary data and answer questions about how the org pays
people (pay equity, distribution, trends, etc.).

This is an assessment deliverable — the reviewers are evaluating engineering judgment,
clarity of thinking, architecture/design decisions, code and test quality, and
intentional use of AI tooling (this project is being built with Claude Code), not just
the end product.

## Tech Stack

Monorepo (single git repo at project root) with two independent apps, no shared
workspace tooling yet (no npm workspaces/Turborepo — add only if real code sharing
between apps becomes necessary):

- `/backend` — NestJS + TypeScript, Prisma ORM, PostgreSQL. Health check at `GET /health`.
  `employees` module is fully implemented (CRUD + pagination/filtering, see Current
  Status); `analytics` module implemented (`GET /analytics/summary`); `salaries`
  module now exposes one write endpoint, `POST /employees/:employeeId/salaries`
  (create-only — see Decision Log), read access is still only via `employees/:id`
  and `analytics`.
- `/frontend` — Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
  (`components.json`, `src/components/ui`).

## Scope Decisions

_Not yet decided — pending input in next session._

### In Scope
- TBD

### Explicitly Out of Scope
- TBD

## Current Status

Monorepo scaffolded: NestJS backend and Next.js frontend both build and lint cleanly.
Prisma schema defined for `Employee` and `SalaryRecord` (see below) and the initial
migration (`20260719175845_add_employee_and_salary_record`) is applied to the local
`mydb` database. `backend/prisma/seed.ts` seeds 10,000 employees with realistic
salary history (see Decision Log); local `mydb` is currently populated by it.

Backend `employees` module: `GET /employees` (paginated, filterable by
department/country/status, name search), `GET /employees/:id` (includes salary
history), `POST`/`PATCH /employees/:id`, `DELETE /employees/:id` (soft-delete —
sets `status: TERMINATED`, does not drop the row). DTOs validated with
`class-validator` behind a global `ValidationPipe`. `EmployeesService` has 17 Jest
unit tests mocking `PrismaService` (no real DB in tests).

Backend `analytics` module: `GET /analytics/summary` — headcount, avg/median salary
by department and by country (each split by currency), total payroll cost by
currency, and a compa-ratio salary distribution histogram. See Decision Log for why
it's currency-segmented rather than FX-converted. 7 Jest unit tests against a
hand-computed fixture dataset (mocked `$queryRaw`, no real DB).

Backend `salaries` module: `POST /employees/:employeeId/salaries` creates a new
`SalaryRecord` for an employee — always inserts, never edits/replaces an existing
row (see Decision Log for why `currency` is server-derived, not client-supplied).
404s if the employee doesn't exist; 400s on validation failure (`amount` must be a
positive number, `effectiveDate` an ISO date string, `reason` one of the
`SalaryChangeReason` enum values). 3 Jest unit tests mocking `PrismaService`.

Frontend layout shell built: root layout renders a persistent `AppShell`
(`src/components/layout/`) — a fixed sidebar (Employees/Analytics/Settings nav,
active-state highlighting via `usePathname`) and a topbar (mobile hamburger toggle,
page title). Routing structure in place: `/employees`, `/employees/[id]`,
`/analytics`, `/settings`, root `/` redirects to `/employees`, plus a root
`not-found.tsx` and `loading.tsx`.

`/employees` is now a working paginated/filterable table (`src/components/employees/`)
built on TanStack Table + TanStack Query, calling `GET /employees` through a Next.js
rewrite proxy at `/api/*` (see Decision Log). Server-side pagination (20/page),
dropdown filters for department/country/status (fixed lists, see Decision Log),
name search debounced 300ms, loading skeleton, empty state, and row click navigates
to `/employees/[id]`.

`/employees/[id]` (`src/components/employees/employee-detail.tsx` +
`salary-history.tsx`) is now built: profile header (name, status badge, email,
department, country, job title, hire date) and a salary history timeline sorted
most-recent-`effectiveDate`-first, plus an inline "Add Salary Record" form (amount,
effective date, reason — currency is never asked for, see Decision Log) that POSTs
to the new `/employees/:id/salaries` endpoint and invalidates the detail query on
success. Loading (skeleton) and not-found (404 from the API) states handled
in-component via TanStack Query's `isPending`/`isError`, matching `EmployeesTable`'s
pattern rather than Next's `notFound()`/`not-found.tsx` file convention (see
Decision Log).

`/analytics` (`src/components/analytics/`) is now a working dashboard: summary
cards (total headcount, total payroll cost — one card per currency, never
FX-converted), an "Average Salary by Department" chart faceted into one small
Recharts bar chart per currency, an "Average Salary by Country" chart (single
chart, every bar direct-labeled with its own currency amount plus a disclaimer
caption — see Decision Log for why department and country needed different
treatments), and a "Salary Distribution" chart of the compa-ratio buckets
(currency-agnostic, so a single ordinary chart). Loading (skeleton) and empty
(`headcount === 0`) states handled the same `useQuery`-driven way as the rest of
the app. First real use of Recharts and of the dataviz skill's categorical
palette (`--chart-1` in `globals.css`) in this project.

Vitest + React Testing Library set up for the frontend (4 tests covering
render/empty-state/debounce/filter-refetch on `EmployeesTable`; 4 more on
`EmployeeDetail` covering profile render, salary-history ordering, not-found state,
and the add-salary-record submit flow; 3 more on `AnalyticsDashboard` covering
summary-card render from mock data, loading state, and empty state); verified
end-to-end against the real seeded backend with Playwright driving system Chrome
(see Decision Log). `/settings` remains placeholder content. Requirements
document and scope decisions still pending.

Completed a frontend polish pass across `/employees`, `/employees/[id]`,
`/analytics`, and `/settings`: per-route `error.tsx` boundaries (see Decision
Log) for unexpected render crashes, retry actions added to every inline
TanStack Query error state (`EmployeesTable`, `AnalyticsDashboard`,
`EmployeeDetail`'s non-404 case) so a failed fetch isn't a dead end, and a
`min-w-0` fix on `AppShell`'s flex column (see Decision Log) so the employees
table scrolls within its own bordered container on narrow viewports instead of
overflowing the whole page. Verified with Playwright at a 375px viewport
against the real backend.

Prepared both apps for deployment (Railway for backend + Postgres, Vercel for
frontend — see Decision Log): `backend/railway.json` pins the Nixpacks build/
start commands so `prisma migrate deploy` runs automatically before the app
starts on every deploy, `backend/package.json` gained a `postinstall: prisma
generate` (needed since `generated/prisma` is gitignored), and `main.ts` now
binds `0.0.0.0` explicitly for container networking. The seed script
deliberately stays out of both — it's documented as a manual one-time step.
No `vercel.json` was added; the frontend needs zero platform-specific config
beyond setting `BACKEND_URL` and the Vercel project's Root Directory. Full
step-by-step runbook (with exactly which dashboard fields to set, since Claude
has no account access to do this itself): [docs/deployment.md](docs/deployment.md).

## Data Model

- `Employee` (`backend/prisma/schema.prisma`): id (uuid), name, email (unique),
  department, country, currency, jobTitle, status (`EmployeeStatus` enum: ACTIVE,
  INACTIVE, TERMINATED — soft-delete style, no hard-delete flow), hireDate, createdAt,
  updatedAt. Indexed on `department` and `country` for HR filtering/reporting queries.
- `SalaryRecord` (one-to-many from `Employee`, via `employeeId`): id (uuid), amount
  (`Decimal(12,2)` — not Float, to avoid FP rounding on money), currency,
  effectiveDate, reason (`SalaryChangeReason` enum: JOINING, HIKE, PROMOTION,
  ADJUSTMENT, CORRECTION), createdAt. Indexed on `employeeId`. Every salary change
  inserts a new row rather than updating in place, so full compensation history is
  preserved per employee.
- FK `SalaryRecord.employeeId → Employee.id` uses `onDelete: Restrict` — deliberately
  chosen over `Cascade` so an employee with salary history can't be hard-deleted and
  silently take that history with it; use the `status` enum (e.g. `TERMINATED`) for
  offboarding instead of deleting the row.

## Decision Log

- 2026-07-19: Chose NestJS (backend) + Next.js/Tailwind/shadcn (frontend) over
  alternatives — matches the assessment's suggested stack, gives structured DI/module
  conventions that scale reasonably to a 10k-row seeded dataset without extra
  boilerplate.
- 2026-07-19: Prisma + PostgreSQL for the ORM/database, even though the assessment
  allows SQLite. Postgres more realistically models a "deployed" multi-country
  production system and Prisma migrations give a clean seed-script story.
- 2026-07-19: No npm workspaces/Turborepo — backend and frontend are independent Node
  projects sharing one git repo. Revisit only if a shared types/package need emerges.
- 2026-07-19: `employees` and `salaries` NestJS modules created empty (no
  controllers/services) — structure decided now, business logic deferred until scope
  doc is finalized.
- 2026-07-19: `Employee`/`SalaryRecord` Prisma schema added with `SalaryRecord` as an
  append-only history table (see Data Model) rather than mutable fields on `Employee` —
  the assessment explicitly calls out answering trend/history questions, which requires
  point-in-time salary data, not just current state.
- 2026-07-20: Prisma 7's `prisma-client` generator (used here, see `schema.prisma`
  generator block) produces a query-compiler/WASM client that has no built-in engine
  for talking to Postgres over TCP — it requires an explicit driver adapter. Added
  `@prisma/adapter-pg` + `pg` as dependencies; any future `PrismaService` must
  construct `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` rather
  than the bare `new PrismaClient()` that worked in Prisma 5/6.
- 2026-07-20: Added `backend/prisma/seed.ts` (`npm run seed` in `/backend`, or
  `prisma db seed`) generating 10,000 employees across 5 countries (US, India, UK,
  Germany, Singapore) with country/department-appropriate salary bands, realistic
  department weighting (Engineering-heavy, Executive smallest), and 2-4 salary-history
  records per employee showing progression (JOINING → HIKE/PROMOTION/ADJUSTMENT/
  CORRECTION). Uses `@faker-js/faker` locale-specific instances per country for name
  realism. Made idempotent via wipe-then-reseed (`deleteMany` on both tables) combined
  with a fixed `faker.seed()` — every run produces byte-identical output, verified by
  hashing employee/salary rows across two consecutive runs. Must run the seed script
  itself (not just `faker`) fully through the seeded `faker` RNG — an earlier draft
  used unseeded `Math.random()` for one branch decision, which desynced the RNG
  stream and silently broke determinism across runs.
- 2026-07-20: Discovered Prisma 7's `prisma-client` generator, with no explicit
  `moduleFormat`, auto-detected ESM and emitted `import.meta.url` in `client.ts`
  (used for an `__dirname` shim). That's silently broken for this project: the
  backend has no `"type": "module"`, so `tsc`'s CommonJS emit left `import.meta`
  untransformed, producing JS that's invalid in both CJS and ESM — `nest build` +
  `node dist/main` crashed the instant any code imported the generated client
  (`ReferenceError: exports is not defined in ES module scope`). This went
  unnoticed because only `prisma/seed.ts` (run via `tsx`, which handles ESM) used
  the client before this session. Fixed by adding `moduleFormat = "cjs"` to the
  `generator client` block and regenerating. Also added
  `moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }` to the Jest config in
  `package.json` — the generated client's internal imports use the
  nodenext-style `./foo.js` extension pointing at `.ts` sources, which ts-jest's
  resolver doesn't rewrite on its own. Any future regeneration of the Prisma
  client must keep `moduleFormat = "cjs"` in the schema or this breaks again.
- 2026-07-20: Added shared `PrismaService`/`PrismaModule` (`backend/src/prisma/`,
  `@Global()`) — first real consumer of the generated client from `src/`.
- 2026-07-20: `EmployeesService.remove()` (the `DELETE /employees/:id` handler)
  does a soft-delete — sets `status: TERMINATED` — rather than actually deleting
  the row. Follows directly from the `onDelete: Restrict` FK decision already in
  the Data Model section: an employee with salary history can't be hard-deleted
  anyway, and `TERMINATED` is the documented offboarding path.
- 2026-07-20: Analytics (`GET /analytics/summary`) uses each employee's *most
  recent* `SalaryRecord` (via a raw `DISTINCT ON` query, not the full history) as
  "current salary," and excludes `TERMINATED` employees — they're no longer on
  payroll, so counting their historical salary would overstate headcount/payroll
  cost. Mirrors the same "current state" reasoning as the soft-delete decision
  above.
- 2026-07-20: Analytics avoids currency conversion entirely. Employees are paid in
  5 currencies with very different magnitudes (INR figures run ~10x USD ones by
  design — see the seed script's `factor` per country), and there's no real FX
  rate source in this project; hardcoding one for a payroll tool would be
  misleading (real FX moves daily) and would conflate currency conversion with
  the seed's market-rate adjustment multiplier, which is a different thing.
  Instead: `byDepartment`/`byCountry` stats are segmented by currency (so
  "Engineering" returns one row per currency it's paid in, not one blended
  number), payroll cost is summed per currency, and the salary distribution
  histogram buckets employees by *compa-ratio* (salary ÷ the median salary of
  their own currency) rather than absolute amount — compa-ratio is the standard
  HR comp-analytics way to compare pay position across currencies/geos without
  conversion.
- 2026-07-20: Fixed a bug where `POST /employees` (and any DB-touching request)
  crashed with a cryptic `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must
  be a string` error the first time a real query ran. Cause: `prisma.config.ts`
  and `prisma/seed.ts` both `import 'dotenv/config'` to load `backend/.env`, but
  `src/main.ts` never did — so under normal `npm run start`/`start:dev` (no
  manually-exported `DATABASE_URL`), `PrismaService` read `process.env.DATABASE_URL`
  as `undefined`, and `pg` fell back to a passwordless connection attempt. Nest
  still booted "successfully" because the driver adapter connects lazily on first
  query, not at `$connect()`. Fixed by adding `import 'dotenv/config'` as the
  first line of `main.ts`. Also hardened `PrismaService`'s constructor to throw a
  clear, actionable error immediately if `DATABASE_URL` is still unset after that
  (covers non-`.env` deployments that forget to set it), instead of letting `pg`
  fail later with the same opaque SASL message.
- 2026-07-20: `frontend/AGENTS.md` flags that this Next.js install (16.2.10) may
  diverge from training data — confirmed relevant: `params`/`searchParams` are
  now `Promise`s (must `await`), and this repo's shadcn setup is a `@base-ui/react`
  fork, not Radix — `Button` has no `asChild` prop. Composing it with `next/link`
  uses base-ui's `render` prop instead: `<Button render={<Link href="/x" />}>label
  </Button>` (the `render` element must be self-closing/childless so the Button's
  own `children` pass through — base-ui's `mergeProps` only overwrites keys that
  exist on the `render` element's own props). Any future shadcn component added
  via the CLI will follow this same `render`-prop pattern, not `asChild`.
- 2026-07-20: Built the frontend layout shell (`src/components/layout/app-shell.tsx`,
  `sidebar.tsx`, `topbar.tsx`) by hand rather than via the shadcn CLI's sidebar
  block — the CLI's default sidebar registry component is built for Radix-style
  `asChild`/context patterns that don't map cleanly onto this project's base-ui
  fork, and the shell itself is simple enough (nav list + mobile slide-in) that
  hand-rolling it with the existing `Button`/`cn` primitives was less risk than
  adapting a generated block. Mobile nav state (`mobileNavOpen`) lives in
  `AppShell` and is threaded to both `Sidebar` and `Topbar` as props rather than
  React context, since only those two siblings need it.
- 2026-07-21: Added a Next.js rewrite (`/api/:path*` → `${BACKEND_URL}/:path*`,
  `next.config.ts`, defaulting to `http://localhost:3000`) rather than enabling
  CORS on the Nest backend or hardcoding an absolute backend URL in client-side
  `fetch` calls. Keeps the browser same-origin (no CORS config needed on the
  backend), keeps the backend origin out of client bundles, and matches how this
  would front a separate API service in production. All frontend data fetching
  (`src/lib/api/*`) calls relative `/api/...` paths through this proxy.
- 2026-07-21: Built `/employees` on TanStack Table (headless) + TanStack Query
  (`@tanstack/react-query`) rather than plain `useEffect`/`fetch` state. Query
  handles request de-duping, in-flight cancellation, and — via
  `placeholderData: keepPreviousData` — keeps the previous page's rows on screen
  (no flash-to-empty) while a new page/filter request is in flight; TanStack
  Table's `manualPagination`/`pageCount` mode defers the actual paging to the
  API response's `meta`, matching the backend's `{ data, meta: { page, pageSize,
  total, totalPages } }` contract exactly.
- 2026-07-21: Department/country/status filter options (`src/lib/constants/
  employee-filters.ts`) are a fixed list mirrored from `backend/prisma/seed.ts`'s
  `DEPARTMENTS`/`COUNTRIES` arrays and the `EmployeeStatus` enum, not fetched from
  the API — there's no distinct-values endpoint yet and the seed data's
  department/country set is fixed, so a fixed list is simpler than adding one.
  Revisit if departments/countries ever become user-editable.
- 2026-07-21: Filter dropdowns (`src/components/ui/select.tsx`) are a styled
  native `<select>`, not a composed `@base-ui/react` Select (listbox/popover).
  These are plain single-choice filters, not rich comboboxes, so a native select
  gets full keyboard/a11y support for free and is trivially testable with RTL
  (`fireEvent.change`) — a base-ui Select's popover/listbox interaction pattern
  would need real user-event click sequences and is more surface area to get
  wrong on a still-unfamiliar fork (see the `Button`/`render`-prop note above).
- 2026-07-21: Added Vitest + React Testing Library for the frontend (`vitest.config.ts`,
  `vitest.setup.ts`, `npm test` in `/frontend`) rather than Jest — Next's official
  guidance offers both; Vitest's native Vite integration needs less Next-specific
  glue (no `next/jest` transform layer) and its `resolve.tsconfigPaths` config
  option resolves the `@/*` alias natively. `@testing-library/react`'s automatic
  per-test `cleanup()` only self-registers when it finds a global `afterEach`;
  since `vitest.config.ts` doesn't set `test.globals: true`, `vitest.setup.ts`
  wires `cleanup()` into `afterEach` explicitly — omitting this causes DOM from
  every previous test in a file to accumulate (surfaced as spurious "multiple
  elements found" query errors).
- 2026-07-21: Verified the employees table end-to-end against the real seeded
  backend (10,001 rows) using Playwright's Node API driving system Chrome
  (`channel: "chrome"`) rather than Playwright's bundled Chromium — the bundled
  browser's cached revision on this machine didn't match what the installed
  `playwright` package expected (`chrome-headless-shell.exe` missing for the
  expected revision) and downloading a new one wasn't worth it for a one-off
  smoke check when system Chrome was already present.

- 2026-07-21: Built the first `salaries` write endpoint,
  `POST /employees/:employeeId/salaries` (`SalariesController`/`SalariesService`,
  filling in the previously-empty `SalariesModule`). Nested under `/employees/:id`
  rather than a flat `/salaries` with `employeeId` in the body, matching how the
  data is already read (`employees/:id` embeds `salaryRecords`). `CreateSalaryRecordDto`
  deliberately has no `currency` field — the service always sets
  `currency: employee.currency` server-side (looked up via the `employeeId` path
  param) rather than trusting a client-supplied value, because `SalaryRecord.currency`
  is expected to always equal the parent `Employee.currency` (true for every seeded
  record — see `seed.ts`'s `country.currency` usage for both) and analytics'
  currency-segmented reporting (see the earlier analytics decision) silently relies
  on that invariant holding. The global `ValidationPipe`'s `forbidNonWhitelisted`
  rejects any request that tries to pass `currency` anyway, so this can't be worked
  around from the client. Only inserts (`prisma.salaryRecord.create`) — there is no
  update/delete route — enforcing the append-only history model at the API level,
  not just by convention.
- 2026-07-21: Built `/employees/[id]` (`EmployeeDetail`/`SalaryHistory` client
  components) as `useQuery`/`isPending`/`isError` state handled inside the
  component, the same pattern `EmployeesTable` already uses, rather than an async
  Server Component + Next's `notFound()`/`not-found.tsx` file convention. Keeps
  every data-fetching page in the app on one consistent, already-tested pattern
  (manual `fetch` stubbing + `QueryClientProvider` in Vitest, no need to mock
  `next/navigation`'s `notFound` or reach for `useSuspenseQuery` + an error
  boundary). The 404 case is distinguished from other failures via a small
  `ApiError` class (`src/lib/api/employees.ts`) that carries the HTTP status code,
  since `fetchEmployee` needs to tell "employee doesn't exist" apart from "backend
  unreachable" to render the right message.
- 2026-07-21: The employee-name heading on `/employees/[id]` is an `<h2>`, not
  `<h1>` — discovered mid-build that `Topbar` (`src/components/layout/topbar.tsx`)
  already renders an `<h1>` page title (derived from the matched nav item, shared
  by every route under `/employees`) for the whole app shell, so a second `<h1>` in
  the page content would be a duplicate top-level heading. `SalaryHistory`'s
  "Salary History" heading is correspondingly `<h3>`, nested under the employee
  name. Worth remembering for any future page content: the app-wide document
  heading is owned by `Topbar`, page bodies should start at `<h2>`.
- 2026-07-21: Fixed a real bug surfaced while browser-testing the new page: base-ui's
  own docs (`node_modules/@base-ui/react/docs/react/components/button.md`) say
  `<a>`/`next/link` should *not* be composed via `Button`'s `render` prop at all —
  "Links have their own semantics and should not be rendered as buttons... style the
  `<a>` element directly with CSS." The `render={<Link .../>}` pattern this project's
  CLAUDE.md previously documented (see the 2026-07-20 base-ui entry) triggers a
  console warning ("expected a native `<button>` because `nativeButton` is true") for
  exactly this reason. Fixed both the new usage in `EmployeeDetail`'s not-found state
  and the pre-existing one in `src/app/not-found.tsx`: both now render `<Link
  className={buttonVariants({...})}>` directly instead of wrapping in `<Button
  render={...}>`. The `render`-prop pattern itself is still correct for composing
  `Button` with non-link custom tags (e.g. `<div>` + `nativeButton={false}`) — the
  fix is specifically "don't put a `Link` inside a `Button`."
- 2026-07-21: `formatDate`/`formatAmount` (`employee-detail.tsx`, `salary-history.tsx`)
  pin `Intl`/`toLocaleDateString` to `"en-US"` rather than the viewer's `undefined`
  locale. Two reasons: an internal HR tool showing the same employee's data to
  different HR staff should render dates/currency identically regardless of each
  viewer's OS locale (avoids `1/7/2026` vs `7/1/2026` ambiguity); and it makes the
  Vitest assertions deterministic — the test runner's default ICU locale on this
  machine formats as `en-GB` (`"1 January 2024"`), which broke `en-US`-shaped
  assertions until pinned.

- 2026-07-21: Built `/analytics` on Recharts (`recharts` added to `frontend/
  package.json`) rather than another charting library — no prior chart library
  precedent in this project, Recharts is the ecosystem default for
  React/Tailwind dashboards and its `ResponsiveContainer` + declarative
  `<Bar>`/`<XAxis>`/`<Tooltip>` API matches how the rest of the frontend is
  already composed (small, typed, composable pieces). Populated the previously-
  unused `--chart-1` token in `globals.css` (`#2a78d6` light / `#3987e5` dark)
  with a validated categorical blue rather than shadcn's grayscale placeholder
  — validated via the project's dataviz skill's `validate_palette.js` against
  this app's actual `--background` surfaces (light `#ffffff`, dark ~`#0a0a0a`);
  every chart in the dashboard is a single-series chart, so only one categorical
  slot was ever needed. Axis/gridline/tooltip chrome reuses the app's existing
  `--border`/`--muted-foreground`/`--popover` tokens rather than importing the
  dataviz skill's separate reference-palette chrome colors, to stay visually
  consistent with the rest of the app.
- 2026-07-21: `byDepartment`/`byCountry` avg-salary data is currency-segmented
  (see the earlier analytics currency decision), and INR figures run ~10-15x
  the other four currencies in the live seeded data (e.g. Engineering: EUR
  ~89,989 / GBP ~65,646 / INR ~1,193,009 / SGD ~130,976 / USD ~104,581) — so a
  single shared Y-axis across currencies was never viable (would either crush
  the non-INR bars flat or need a log scale that misrepresents magnitude).
  Department and country ended up needing *different* fixes for the same root
  problem, because their data shapes differ: every department has employees in
  all 5 currencies (real multi-bar-per-currency data), so
  `DepartmentSalaryChart` facets into one small-multiples Recharts panel per
  currency — each panel's Y-axis is internally consistent since it's all one
  currency. Country, by contrast, has exactly one currency per country in this
  seed (US→USD, India→INR, etc. — see `seed.ts`'s `country.currency`), so the
  same faceting approach would produce five separate one-bar "charts," which
  is a known bad pattern (a single value should be a stat tile, not forced bar
  geometry). Asked the user how to handle the country case specifically; chose
  a single bar chart with every bar direct-labeled with its own currency-
  formatted value (Y-axis ticks hidden — a shared numeric axis across mixed
  currencies would be actively misleading) plus a caption disclaiming that
  amounts aren't FX-converted/comparable, over faceting into single-bar
  panels — this was the option that most literally satisfies "a bar chart"
  while still not asserting a false cross-currency comparison via axis
  position. `SalaryDistributionChart` (compa-ratio buckets) didn't hit this
  problem at all — compa-ratio is already currency-agnostic by construction,
  so it's one ordinary single-axis chart.
- 2026-07-21: Added `frontend/src/lib/format.ts` (`formatCurrency`,
  `formatCompactCurrency`, `formatNumber`, `formatDate`, all pinned to
  `"en-US"` — see the earlier locale-pinning decision) and refactored
  `salary-history.tsx`/`employee-detail.tsx` to import from it instead of each
  keeping its own copy of the same `Intl.NumberFormat`/`toLocaleDateString`
  calls — the analytics dashboard needed the same currency formatting in four
  more places (summary cards, all three charts' tooltips/labels), so this was
  the first point where duplicating it a fifth and sixth time stopped making
  sense.
- 2026-07-21: Added `frontend/src/components/ui/card.tsx` (`Card`,
  `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`) hand-rolled
  rather than via the shadcn CLI — unlike the `Select`/sidebar cases documented
  earlier, this wasn't about base-ui incompatibility (Card has no interactive
  primitive at all, just styled `div`s), it was simpler to just match the
  existing `rounded-lg border border-border p-6` convention already used
  inline in `employee-detail.tsx`'s profile section than to invoke the CLI for
  something this small.
- 2026-07-21: Added per-route Next.js `error.tsx` boundaries
  (`app/employees/error.tsx`, `app/employees/[id]/error.tsx`,
  `app/analytics/error.tsx`, `app/settings/error.tsx`), each a thin wrapper
  around a new shared `src/components/page-error.tsx` (icon, message, a "Try
  again" button wired to Next's `reset()`). Deliberately per-route rather than
  one root `app/error.tsx` — a root boundary would unmount the whole `AppShell`
  (sidebar/topbar) on any single page's crash, forcing every recovery through a
  full-page reset; per-route boundaries keep navigation alive so the user can
  route away instead. These only catch unexpected render exceptions, not the
  TanStack Query fetch failures every data-fetching component already renders
  inline via `isError` — those got their own fix in the same pass: `EmployeesTable`,
  `AnalyticsDashboard`, and `EmployeeDetail`'s non-404 error branch previously
  showed a "Please try again" message with no actual way to retry short of a
  manual page reload; each now has a "Retry" button calling `query.refetch()`.
- 2026-07-21: Fixed a latent responsive bug found while auditing the app for a
  mobile pass: `AppShell`'s right-hand column (`flex-1 flex-col`, wrapping
  `Topbar` + `<main>`) had no `min-w-0`. Flexbox items default to
  `min-width: auto`, i.e. they won't shrink below their content's intrinsic
  width — so a wide child (the employees table, which already wraps itself in
  `overflow-x-auto`, see `ui/table.tsx`) would have forced the *whole page*
  wider than the viewport instead of scrolling inside its own bordered
  container. Added `min-w-0` to both the flex column and `<main>`. Verified
  with Playwright at a 375px viewport against the real backend: `document.body
  .scrollWidth` now equals the viewport width, and the table's own wrapper
  (not the page) is what scrolls.
- 2026-07-21: Chose Railway (backend + Postgres) and Vercel (frontend) for
  deployment, matching the two-independent-apps monorepo structure already in
  place (see Tech Stack) rather than adopting workspace tooling or a combined
  deploy target now. Set each platform's "Root Directory" to `backend`/
  `frontend` respectively instead of adding a root-level build script,
  keeping the no-shared-tooling decision intact.
- 2026-07-21: `backend/railway.json` sets the deploy start command to
  `npx prisma migrate deploy && npm run start:prod` rather than relying on a
  separate Railway "release phase" — Railway doesn't have a distinct
  pre-deploy/release-command concept the way Heroku does, and chaining
  `migrate deploy` in front of the start command is the standard Prisma-on-
  Railway pattern: it's safe to run on every deploy (idempotent — only
  unapplied migrations run) and guarantees the schema is current before the
  app starts accepting traffic. Explicitly did *not* wire `prisma db seed`/
  `npm run seed` into this chain: the seed script wipes and re-inserts all
  rows (see the seed idempotency note above), which is fine for a one-time
  local `npm run seed` but would be destructive if it silently ran against a
  live production database on every re-deploy. It's documented in
  `docs/deployment.md` as a manual `railway run npm run seed` step instead.
- 2026-07-21: Added `postinstall: prisma generate` to `backend/package.json`
  because `generated/prisma` is gitignored (`backend/.gitignore`) — a fresh
  `npm ci` on Railway (or any clean clone) has no Prisma Client until
  something generates it, and unlike `prisma migrate dev`, `prisma generate`
  needs no live DB connection, so it's safe to run at install/build time
  before `DATABASE_URL` is necessarily reachable.
- 2026-07-21: Added `'0.0.0.0'` as the explicit bind host in `main.ts`'s
  `app.listen()` call. Node's default (no host arg) already listens on all
  interfaces, so this was likely a no-op for Railway specifically, but it's
  the documented-safe pattern for containerized Node deploys generally and
  costs nothing to make explicit.
- 2026-07-21: No `vercel.json` added for the frontend — nothing in
  `next.config.ts` (a same-origin API rewrite, a Turbopack root path) needs
  Vercel-specific handling beyond what its zero-config Next.js App Router
  preset already infers. The only required project-level setting is Root
  Directory (`frontend`), configured in the Vercel dashboard, not in a
  committed file.
- 2026-07-21: `frontend/.gitignore`'s inherited-from-`create-next-app`
  `.env*` pattern silently also matched `.env.example`, which would have made
  the new `frontend/.env.example` un-committable. Added `!.env.example` to
  negate it — mirrors `backend/.gitignore`, which already only ignores the
  literal `.env`, not the `.example` file.

## Reference

- Full original assessment requirement (verbatim): [docs/00-original-requirement.md](docs/00-original-requirement.md)
- Manual curl requests for every backend endpoint (Postman-importable): [docs/01-api-curl-requests.md](docs/01-api-curl-requests.md)

# Architecture Overview

## Stack

Monorepo (single git repo at project root) with two independent apps and no shared
workspace tooling (no npm workspaces/Turborepo — deliberately deferred until real
code-sharing between the two apps becomes necessary):

- **Backend** (`/backend`) — NestJS + TypeScript, Prisma ORM, PostgreSQL. Chosen over
  alternatives (SQLite was explicitly allowed by the assessment) because Postgres more
  realistically models a deployed, multi-country production system, and Prisma
  migrations give a clean seed-script story. NestJS matches the assessment's
  suggested stack and gives structured DI/module conventions that scale to a 10k-row
  seeded dataset without extra boilerplate.
- **Frontend** (`/frontend`) — Next.js (App Router) + TypeScript + Tailwind CSS v4 +
  shadcn/ui (on a `@base-ui/react` fork, not Radix).
- **Deployment** — Railway (backend + Postgres) and Vercel (frontend), matching the
  two-independent-apps structure: each platform's "Root Directory" is set to
  `backend`/`frontend` rather than adding a root-level build script or workspace
  tooling.

## Data Model

Two tables, in an explicit one-to-many, append-only relationship:

- **`Employee`** — id (uuid), name, email (unique), department, country, currency,
  jobTitle, status (`EmployeeStatus`: ACTIVE, INACTIVE, TERMINATED), hireDate,
  createdAt, updatedAt. Indexed on `department` and `country` for HR filtering/
  reporting queries.
- **`SalaryRecord`** — id (uuid), amount (`Decimal(12,2)` — not `Float`, to avoid
  floating-point rounding on money), currency, effectiveDate, reason
  (`SalaryChangeReason`: JOINING, HIKE, PROMOTION, ADJUSTMENT, CORRECTION),
  createdAt. Indexed on `employeeId`. Every salary change **inserts a new row**
  rather than updating in place, preserving full compensation history per employee —
  this follows directly from the requirement to answer trend/history questions,
  which needs point-in-time data, not just current state.
- The FK `SalaryRecord.employeeId → Employee.id` uses `onDelete: Restrict`
  (deliberately not `Cascade`), so an employee with salary history can't be
  hard-deleted and silently take that history with it. Offboarding uses the
  `status` enum instead of deleting the row (see soft-delete decision below).

Seeded via `backend/prisma/seed.ts`: 10,000 employees across 5 countries (US, India,
UK, Germany, Singapore) with country/department-appropriate salary bands, realistic
department weighting, and 2-4 salary-history records per employee. Made
deterministic (fixed `faker.seed()`, wipe-then-reseed) so every run produces
byte-identical output.

## API Structure

- **`employees`** module — `GET /employees` (paginated, filterable by department/
  country/status, name search), `GET /employees/:id` (includes salary history),
  `POST`/`PATCH /employees/:id`, `DELETE /employees/:id`. `DELETE` is a
  **soft-delete**: sets `status: TERMINATED` rather than removing the row, since an
  employee with salary history can't be hard-deleted anyway (see the FK
  `onDelete: Restrict` above), and `TERMINATED` is the documented offboarding path.
- **`salaries`** module — one write endpoint, `POST /employees/:employeeId/salaries`,
  nested under `/employees/:id` to match how the data is already read. Always
  inserts (`prisma.salaryRecord.create`); there is no update/delete route, enforcing
  the append-only history model at the API level, not just by convention.
  `currency` is deliberately not a client-supplied field — the service always sets
  it server-side from the parent employee's `currency`, since `SalaryRecord.currency`
  is expected to always equal `Employee.currency`, and analytics' currency-segmented
  reporting silently relies on that invariant holding. The global `ValidationPipe`'s
  `forbidNonWhitelisted` rejects any request that tries to pass `currency` anyway.
- **`analytics`** module — `GET /analytics/summary`: headcount, avg/median salary by
  department and by country (each split by currency), total payroll cost by
  currency, and a compa-ratio salary-distribution histogram. Uses each employee's
  *most recent* `SalaryRecord` (via a raw `DISTINCT ON` query) as "current salary,"
  and excludes `TERMINATED` employees — they're no longer on payroll, so counting
  their historical salary would overstate headcount/payroll cost.
- All DTOs validated with `class-validator` behind a global `ValidationPipe`.
- Frontend never calls the backend origin directly: a Next.js rewrite
  (`/api/:path*` → `${BACKEND_URL}/:path*`) keeps the browser same-origin, avoiding
  CORS config on the backend and keeping the backend origin out of client bundles.

## Key Trade-offs

- **No currency conversion, anywhere.** Employees are paid in 5 currencies with very
  different magnitudes by design (e.g. INR figures run ~10-15x USD ones). There's no
  real FX rate source in this project, and hardcoding one would be misleading (real
  FX moves daily) and would conflate currency conversion with the seed's
  market-rate adjustment multiplier — a different thing. Instead: analytics
  segments every stat by currency, and the salary-distribution histogram uses
  compa-ratio (salary ÷ median salary of the same currency) to compare pay position
  across currencies/geos without converting.
- **Department vs. country charts needed different treatments** for the same root
  problem (no shared axis across currencies): every department has employees in all
  5 currencies, so `DepartmentSalaryChart` facets into one small chart per currency.
  Every country in the seed pays in exactly one currency, so faceting would produce
  five separate one-bar "charts" (a known bad pattern) — instead, country uses a
  single bar chart with every bar direct-labeled in its own currency, Y-axis ticks
  hidden, plus a caption disclaiming the bars aren't FX-comparable.
- **Salary history is append-only, enforced at the API level**, not just by
  convention — there is no update/delete route on `salaries`, and edits are modeled
  as a new record with reason `CORRECTION` rather than mutating history.
- **Soft-delete over hard-delete** for employees, following directly from the FK
  `onDelete: Restrict` choice — an employee with salary history literally cannot be
  hard-deleted, so offboarding uses `status: TERMINATED`.
- **Prisma 7's `prisma-client` generator** needs an explicit driver adapter
  (`@prisma/adapter-pg`) to talk to Postgres, and defaults to ESM output unless
  `moduleFormat = "cjs"` is set in the generator block — left un-pinned, this
  silently breaks `nest build`/`node dist/main` (the backend has no
  `"type": "module"`, so `tsc`'s CJS emit leaves `import.meta` untransformed).
  Fixed once, documented so future client regenerations don't reintroduce it.
- **Fixed department/country filter lists** on the frontend, mirrored from the
  seed script, rather than a distinct-values API endpoint — simpler given there's
  no product requirement yet for user-editable departments/countries.
- **Migrations run automatically on every backend deploy** (`prisma migrate deploy`
  chained in front of the start command in `railway.json`) since it's idempotent
  (only unapplied migrations run), but the **seed script is deliberately excluded**
  from any deploy pipeline — it wipes and re-inserts all rows, which would be
  destructive if it ran against a live production database. It's documented as a
  manual one-time step in [deployment.md](deployment.md).

## Testing

- Backend: Jest unit tests against mocked `PrismaService`/`$queryRaw` — no real DB
  in tests. 17 tests on `EmployeesService`, 7 on analytics (hand-computed fixture
  dataset), 3 on `SalariesService`.
- Frontend: Vitest + React Testing Library (11 tests across `EmployeesTable`,
  `EmployeeDetail`, `AnalyticsDashboard`), chosen over Jest for its native Vite
  integration and `resolve.tsconfigPaths` support for the `@/*` alias.
- End-to-end smoke verification against the real seeded backend (10,001 rows) done
  with Playwright driving system Chrome, including a 375px mobile-viewport pass.

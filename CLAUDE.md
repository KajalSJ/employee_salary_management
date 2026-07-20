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
  Status); `analytics` module implemented (`GET /analytics/summary`); `salaries` is
  still an empty NestJS module (registered in `app.module.ts`, no controller/service —
  salary *writes* aren't exposed yet, only read via `employees/:id` and `analytics`).
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

No UI built yet. Requirements document and scope decisions still pending.

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

## Reference

- Full original assessment requirement (verbatim): [docs/00-original-requirement.md](docs/00-original-requirement.md)
- Manual curl requests for every backend endpoint (Postman-importable): [docs/01-api-curl-requests.md](docs/01-api-curl-requests.md)

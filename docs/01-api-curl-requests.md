# API curl Requests

Manual test requests for the backend API. Every command targets
`http://localhost:3000` (the default from `process.env.PORT ?? 3000` in
`backend/src/main.ts`) — change the host/port if you're running elsewhere.

To test in Postman: **File → Import → Raw text**, paste one command, repeat per
endpoint. Postman's curl importer understands standard `curl` syntax directly.

Start the server first:

```bash
cd backend
npm run start:dev
```

## Contents

- [Health](#health)
- [Employees](#employees)
- [Analytics](#analytics)
- [Resetting the database](#resetting-the-database)

## Health

```bash
curl http://localhost:3000/health
```

## Employees

Base path: `/employees`. List/filter fields: `page`, `pageSize` (max 100),
`department`, `country`, `status` (`ACTIVE` | `INACTIVE` | `TERMINATED`), `search`
(matches employee name, case-insensitive).

### List — default pagination

```bash
curl "http://localhost:3000/employees"
```

### List — pagination

```bash
curl "http://localhost:3000/employees?page=2&pageSize=10"
```

### List — filter by department + country

```bash
curl "http://localhost:3000/employees?department=Engineering&country=India"
```

### List — filter by status

```bash
curl "http://localhost:3000/employees?status=ACTIVE"
```

### List — search by name

```bash
curl "http://localhost:3000/employees?search=aadi"
```

### List — combined filters

```bash
curl "http://localhost:3000/employees?department=Engineering&country=India&status=ACTIVE&search=aadi&page=1&pageSize=5"
```

### Get by id (includes salary history)

Replace the id with one from a `list`/`create` response, or use this seeded one:

```bash
curl http://localhost:3000/employees/138ecf23-442d-4f87-bc08-64e0bc148aff
```

### Get by id — 404 (valid UUID, not found)

```bash
curl http://localhost:3000/employees/00000000-0000-4000-8000-000000000000
```

### Get by id — 400 (malformed UUID)

```bash
curl http://localhost:3000/employees/not-a-uuid
```

### Create

```bash
curl -X POST http://localhost:3000/employees \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Person",
    "email": "test.person.qa@acme.com",
    "department": "Engineering",
    "country": "United States",
    "currency": "USD",
    "jobTitle": "Software Engineer",
    "hireDate": "2024-01-15"
  }'
```

### Create — 409 conflict (duplicate email)

Run the "Create" request above once first, then repeat with the same email:

```bash
curl -X POST http://localhost:3000/employees \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dup",
    "email": "test.person.qa@acme.com",
    "department": "Sales",
    "country": "United States",
    "currency": "USD",
    "jobTitle": "Account Executive",
    "hireDate": "2024-01-15"
  }'
```

### Create — 400 validation error

Bad email format plus an unexpected field (rejected by the global
`ValidationPipe`'s `whitelist`/`forbidNonWhitelisted` settings):

```bash
curl -X POST http://localhost:3000/employees \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Input",
    "email": "not-an-email",
    "department": "Engineering",
    "country": "US",
    "currency": "USD",
    "jobTitle": "X",
    "hireDate": "2024-01-15",
    "unexpectedField": "rejected"
  }'
```

### Update (partial)

Replace `<id>` with an id from a create/list response:

```bash
curl -X PATCH http://localhost:3000/employees/<id> \
  -H "Content-Type: application/json" \
  -d '{ "jobTitle": "Senior Software Engineer" }'
```

### Delete (soft-delete → sets status to TERMINATED)

```bash
curl -X DELETE http://localhost:3000/employees/<id>
```

## Analytics

```bash
curl http://localhost:3000/analytics/summary
```

Returns:
- `headcount` — count of non-`TERMINATED` employees
- `byDepartment` / `byCountry` — avg/median of each employee's latest salary,
  grouped and **segmented by currency** (a department spans multiple currencies,
  so blending them into one number would be meaningless without an FX rate,
  which this project deliberately doesn't fabricate — see `CLAUDE.md`)
- `payrollCostByCurrency` — sum of latest salaries per currency
- `salaryDistribution` — headcount bucketed by **compa-ratio** (salary ÷ the
  median salary of that employee's own currency), not absolute amount

## Resetting the database

The `Create`/`Update`/`Delete` requests above mutate real rows in your local
`mydb`. To restore the deterministic seeded state:

```bash
cd backend
npm run seed
```

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
  `employees` and `salaries` are empty NestJS modules (registered in `app.module.ts`,
  no controllers/services yet).
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
No domain code (employee/salary models, endpoints, UI) written yet. Requirements
document and scope decisions still pending.

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

## Reference

- Full original assessment requirement (verbatim): [docs/00-original-requirement.md](docs/00-original-requirement.md)

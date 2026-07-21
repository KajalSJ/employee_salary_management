# Requirements — Employee Salary Management

## Goal

Replace ACME org's Excel-based salary tracking with web-based software that lets the
HR Manager manage salary data for 10,000 employees across multiple countries, and
answer questions about how the org pays people (pay equity, distribution, trends).

## User Persona

HR Manager — the sole user persona for this system. All feature and scope decisions
are made from this persona's point of view: someone who needs to look up and update
individual employee salary records, and to pull aggregate answers about org-wide pay
(by department, by country, over time) without exporting to a spreadsheet.

## Scope

### In Scope

- **Employee records** — CRUD, with pagination and filtering (department, country,
  status, name search) so the HR Manager can find any employee across 10,000 rows.
- **Salary history per employee** — an append-only history of salary changes
  (joining, hike, promotion, adjustment, correction), not just a single current
  figure, so the tool can answer trend/history questions, not only current state.
- **Adding new salary records** — the HR Manager can record a new salary change
  (amount, effective date, reason) for an employee.
- **Org-wide analytics** — headcount, average/median salary by department and by
  country, total payroll cost, and a salary-distribution view, so the HR Manager can
  answer pay-equity/distribution questions without leaving the tool.
- **Multi-country/multi-currency support** — employees are paid in their local
  currency; analytics report per-currency rather than silently blending currencies.
- **Offboarding** — marking an employee as terminated (soft-delete), not deleting
  their record, since salary history must be preserved for past employees too.

### Explicitly Out of Scope

- **Editing or deleting existing salary records.** Only new records can be created;
  the write API is create-only. Salary data is a compensation history — allowing
  in-place edits or deletes would let the audit trail be rewritten, which is a
  correctness/trust risk for a compensation system. If a value was wrong, the
  correct fix is a new record with reason `CORRECTION`, preserving what was actually
  paid at the time.
- **Hard-deleting employees.** An employee with salary history can't be removed
  without losing that history, so offboarding is modeled as a status change
  (`TERMINATED`), not a row deletion.
- **Currency conversion / FX rates.** Analytics never converts between currencies.
  There is no live FX rate source in this project, and hardcoding one would be
  misleading in a payroll tool (real FX rates move daily) and would conflate two
  different things: currency conversion and the seed data's market-rate adjustment
  multiplier. Instead, analytics segments by currency and uses compa-ratio (salary
  ÷ median salary of the same currency) to compare pay position across currencies
  without converting.
- **User authentication / roles / multi-tenant access control.** The persona is a
  single HR Manager; there's no requirement (yet) for multiple roles, login, or
  per-user permissions, and adding one would be speculative scope for an assessment
  deliverable.
- **Editable department/country lists.** Department and country values are a fixed
  set mirrored from the seed data, not a user-managed lookup table — there's no
  product requirement yet for HR to add new departments/countries themselves.
- **Reporting exports (CSV/PDF) and audit logging UI.** Not requested by the
  problem statement; would be natural next steps but are additional scope beyond
  "manage salary data and answer questions about pay."

## Reference

The full original assessment brief this project was scoped against is at
[00-original-requirement.md](00-original-requirement.md).

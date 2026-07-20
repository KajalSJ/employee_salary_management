import type { EmployeeStatus } from "@/lib/api/employees";

// Mirrors backend/prisma/seed.ts DEPARTMENTS/COUNTRIES names. There's no
// distinct-values endpoint yet, so this is a fixed list rather than one
// populated from the API — see CLAUDE.md decision log.
export const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Customer Support",
  "Operations",
  "Marketing",
  "Product",
  "Finance",
  "HR",
  "Legal",
  "Executive",
] as const;

export const COUNTRIES = [
  "United States",
  "India",
  "United Kingdom",
  "Germany",
  "Singapore",
] as const;

export const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "TERMINATED",
];

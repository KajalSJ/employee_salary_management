import type { SalaryChangeReason } from "@/lib/api/employees";

export const SALARY_REASON_LABELS: Record<SalaryChangeReason, string> = {
  JOINING: "Joining",
  HIKE: "Hike",
  PROMOTION: "Promotion",
  ADJUSTMENT: "Adjustment",
  CORRECTION: "Correction",
};

// JOINING is set once, at hire time, on the employee's first salary record —
// it isn't a reason an HR manager should be able to add later.
export const ADDABLE_SALARY_REASONS: Exclude<SalaryChangeReason, "JOINING">[] =
  ["HIKE", "PROMOTION", "ADJUSTMENT", "CORRECTION"];

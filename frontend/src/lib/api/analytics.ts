import { apiFetch } from "@/lib/api/client";

export interface DepartmentStats {
  department: string;
  currency: string;
  headcount: number;
  avgSalary: number;
  medianSalary: number;
}

export interface CountryStats {
  country: string;
  currency: string;
  headcount: number;
  avgSalary: number;
  medianSalary: number;
}

export interface PayrollCost {
  currency: string;
  total: number;
}

export interface DistributionBucket {
  label: string;
  count: number;
}

export interface AnalyticsSummary {
  headcount: number;
  byDepartment: DepartmentStats[];
  byCountry: CountryStats[];
  payrollCostByCurrency: PayrollCost[];
  salaryDistribution: DistributionBucket[];
}

export async function fetchAnalyticsSummary(
  signal?: AbortSignal
): Promise<AnalyticsSummary> {
  const res = await apiFetch("/api/analytics/summary", { signal });

  if (!res.ok) {
    throw new Error(`Failed to fetch analytics summary (${res.status})`);
  }

  return res.json();
}

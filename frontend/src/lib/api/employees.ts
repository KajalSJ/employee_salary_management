import { apiFetch, ApiError } from "@/lib/api/client";

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  country: string;
  currency: string;
  jobTitle: string;
  status: EmployeeStatus;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeesQuery {
  page: number;
  pageSize: number;
  department?: string;
  country?: string;
  status?: EmployeeStatus;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export type SalaryChangeReason =
  | "JOINING"
  | "HIKE"
  | "PROMOTION"
  | "ADJUSTMENT"
  | "CORRECTION";

export interface SalaryRecord {
  id: string;
  employeeId: string;
  amount: string;
  currency: string;
  effectiveDate: string;
  reason: SalaryChangeReason;
  createdAt: string;
}

export interface EmployeeDetail extends Employee {
  salaryRecords: SalaryRecord[];
}

export { ApiError };

export async function fetchEmployee(
  id: string,
  signal?: AbortSignal
): Promise<EmployeeDetail> {
  const res = await apiFetch(`/api/employees/${id}`, { signal });

  if (!res.ok) {
    throw new ApiError(`Failed to fetch employee (${res.status})`, res.status);
  }

  return res.json();
}

export interface CreateSalaryRecordInput {
  amount: number;
  effectiveDate: string;
  reason: Exclude<SalaryChangeReason, "JOINING">;
}

export async function createSalaryRecord(
  employeeId: string,
  input: CreateSalaryRecordInput
): Promise<SalaryRecord> {
  const res = await apiFetch(`/api/employees/${employeeId}/salaries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new ApiError(
      `Failed to add salary record (${res.status})`,
      res.status
    );
  }

  return res.json();
}

export async function fetchEmployees(
  query: EmployeesQuery,
  signal?: AbortSignal
): Promise<PaginatedResult<Employee>> {
  console.log("Fetching employees with query:", query);
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.department) params.set("department", query.department);
  if (query.country) params.set("country", query.country);
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);

  const res = await apiFetch(`/api/employees?${params.toString()}`, { signal });

  if (!res.ok) {
    throw new Error(`Failed to fetch employees (${res.status})`);
  }

  return res.json();
}

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

export async function fetchEmployees(
  query: EmployeesQuery,
  signal?: AbortSignal
): Promise<PaginatedResult<Employee>> {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.department) params.set("department", query.department);
  if (query.country) params.set("country", query.country);
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);

  const res = await fetch(`/api/employees?${params.toString()}`, { signal });

  if (!res.ok) {
    throw new Error(`Failed to fetch employees (${res.status})`);
  }

  return res.json();
}

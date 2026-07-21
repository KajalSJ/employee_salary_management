import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  COUNTRIES,
  DEPARTMENTS,
  EMPLOYEE_STATUSES,
} from "@/lib/constants/employee-filters";
import type { EmployeeStatus } from "@/lib/api/employees";

export interface EmployeesFiltersValue {
  search: string;
  department: string;
  country: string;
  status: string;
}

export function EmployeesFilters({
  value,
  onChange,
}: {
  value: EmployeesFiltersValue;
  onChange: (next: EmployeesFiltersValue) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search by name…"
          aria-label="Search by name"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="w-56 pl-8"
        />
      </div>

      <Select
        aria-label="Filter by department"
        value={value.department}
        onChange={(e) => onChange({ ...value, department: e.target.value })}
      >
        <option value="">All departments</option>
        {DEPARTMENTS.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by country"
        value={value.country}
        onChange={(e) => onChange({ ...value, country: e.target.value })}
      >
        <option value="">All countries</option>
        {COUNTRIES.map((country) => (
          <option key={country} value={country}>
            {country}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by status"
        value={value.status}
        onChange={(e) => onChange({ ...value, status: e.target.value })}
      >
        <option value="">All statuses</option>
        {EMPLOYEE_STATUSES.map((status: EmployeeStatus) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </Select>
    </div>
  );
}

import { createColumnHelper } from "@tanstack/react-table";

import type { Employee, EmployeeStatus } from "@/lib/api/employees";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<
  EmployeeStatus,
  "success" | "secondary" | "destructive"
> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  TERMINATED: "destructive",
};

const columnHelper = createColumnHelper<Employee>();

export const employeeColumns = [
  columnHelper.accessor("name", {
    header: "Name",
    cell: (info) => (
      <span className="font-medium">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("email", {
    header: "Email",
    cell: (info) => (
      <span className="text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("department", {
    header: "Department",
  }),
  columnHelper.accessor("country", {
    header: "Country",
  }),
  columnHelper.accessor("jobTitle", {
    header: "Job Title",
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue();
      return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
    },
  }),
];

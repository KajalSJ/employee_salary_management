"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SalaryHistory } from "@/components/employees/salary-history";
import { ApiError, fetchEmployee, type EmployeeStatus } from "@/lib/api/employees";
import { formatDate } from "@/lib/format";

const STATUS_VARIANT: Record<
  EmployeeStatus,
  "success" | "secondary" | "destructive"
> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  TERMINATED: "destructive",
};

export function EmployeeDetail({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["employee", id],
    queryFn: ({ signal }) => fetchEmployee(id, signal),
    retry: false,
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  if (query.isError) {
    const isNotFound =
      query.error instanceof ApiError && query.error.status === 404;

    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <UserX className="size-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold">
          {isNotFound ? "Employee not found" : "Failed to load employee"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isNotFound
            ? "This employee doesn't exist or may have been removed."
            : "Something went wrong. Please try again."}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {!isNotFound && (
            <Button
              variant="outline"
              onClick={() => query.refetch()}
            >
              Retry
            </Button>
          )}
          <Link
            href="/employees"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to Employees
          </Link>
        </div>
      </div>
    );
  }

  const employee = query.data;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{employee.name}</h2>
          <Badge variant={STATUS_VARIANT[employee.status]}>
            {employee.status}
          </Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{employee.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Department</dt>
            <dd>{employee.department}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Country</dt>
            <dd>{employee.country}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Job Title</dt>
            <dd>{employee.jobTitle}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hire Date</dt>
            <dd>{formatDate(employee.hireDate)}</dd>
          </div>
        </dl>
      </section>

      <SalaryHistory employeeId={employee.id} records={employee.salaryRecords} />
    </div>
  );
}

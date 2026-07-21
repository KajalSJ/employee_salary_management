"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { employeeColumns } from "@/components/employees/columns";
import {
  EmployeesFilters,
  type EmployeesFiltersValue,
} from "@/components/employees/employees-filters";
import { fetchEmployees, type EmployeeStatus } from "@/lib/api/employees";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const EMPTY_FILTERS: EmployeesFiltersValue = {
  search: "",
  department: "",
  country: "",
  status: "",
};

export function EmployeesTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<EmployeesFiltersValue>(EMPTY_FILTERS);

  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const query = useQuery({
    queryKey: [
      "employees",
      {
        page,
        pageSize: PAGE_SIZE,
        department: filters.department,
        country: filters.country,
        status: filters.status,
        search: debouncedSearch,
      },
    ],
    queryFn: ({ signal }) =>
      fetchEmployees(
        {
          page,
          pageSize: PAGE_SIZE,
          department: filters.department || undefined,
          country: filters.country || undefined,
          status: (filters.status || undefined) as EmployeeStatus | undefined,
          search: debouncedSearch || undefined,
        },
        signal
      ),
    placeholderData: keepPreviousData,
  });

  const employees = query.data?.data ?? [];
  const meta = query.data?.meta;

  const table = useReactTable({
    data: employees,
    columns: employeeColumns,
    manualPagination: true,
    pageCount: meta?.totalPages ?? -1,
    getCoreRowModel: getCoreRowModel(),
  });

  function handleFiltersChange(next: EmployeesFiltersValue) {
    if (
      next.department !== filters.department ||
      next.country !== filters.country ||
      next.status !== filters.status
    ) {
      setPage(1);
    }
    setFilters(next);
  }

  const isInitialLoad = query.isPending;
  const isEmpty = query.isSuccess && employees.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <EmployeesFilters value={filters} onChange={handleFiltersChange} />

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isInitialLoad ? (
              Array.from({ length: 8 }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-transparent">
                  {employeeColumns.map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : query.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={employeeColumns.length}
                  className="h-40 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-destructive">
                      Failed to load employees. Please try again.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => query.refetch()}
                    >
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : isEmpty ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={employeeColumns.length}
                  className="h-40 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="size-6" aria-hidden="true" />
                    <p className="text-sm">No employees found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`View ${row.original.name}`}
                  onClick={() => router.push(`/employees/${row.original.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      router.push(`/employees/${row.original.id}`);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta && !isEmpty && !query.isError && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {meta.total} employee{meta.total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <span>
              Page {meta.page} of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

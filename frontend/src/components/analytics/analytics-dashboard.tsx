"use client";

import { useQuery } from "@tanstack/react-query";
import { ChartColumnBig } from "lucide-react";

import { CountrySalaryChart } from "@/components/analytics/country-salary-chart";
import { DepartmentSalaryChart } from "@/components/analytics/department-salary-chart";
import { SalaryDistributionChart } from "@/components/analytics/salary-distribution-chart";
import { SummaryCards } from "@/components/analytics/summary-cards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAnalyticsSummary } from "@/lib/api/analytics";

export function AnalyticsDashboard() {
  const query = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: ({ signal }) => fetchAnalyticsSummary(signal),
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm text-destructive">
          Failed to load analytics. Please try again.
        </p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const data = query.data;

  if (data.headcount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted-foreground">
        <ChartColumnBig className="size-6" aria-hidden="true" />
        <p className="text-sm">No salary data available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SummaryCards
        headcount={data.headcount}
        payrollCostByCurrency={data.payrollCostByCurrency}
      />
      <DepartmentSalaryChart data={data.byDepartment} />
      <CountrySalaryChart data={data.byCountry} />
      <SalaryDistributionChart data={data.salaryDistribution} />
    </div>
  );
}

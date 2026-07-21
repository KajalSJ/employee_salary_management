"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DepartmentStats } from "@/lib/api/analytics";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

function groupByCurrency(rows: DepartmentStats[]) {
  const groups = new Map<string, DepartmentStats[]>();
  for (const row of rows) {
    const list = groups.get(row.currency) ?? [];
    list.push(row);
    groups.set(row.currency, list);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function DepartmentTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as DepartmentStats;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-sm">
      <p className="font-medium">{point.department}</p>
      <p className="text-muted-foreground">
        {formatCurrency(point.avgSalary, currency)} avg &middot;{" "}
        {point.headcount} employees
      </p>
    </div>
  );
}

export function DepartmentSalaryChart({ data }: { data: DepartmentStats[] }) {
  const groups = groupByCurrency(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Average Salary by Department
        </CardTitle>
        <CardDescription>
          One panel per currency — amounts aren&apos;t combined or converted
          across currencies.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {groups.map(([currency, rows]) => (
          <div key={currency}>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              {currency}
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={rows}
                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="department"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={55}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(value: number) =>
                    formatCompactCurrency(value, currency)
                  }
                />
                <Tooltip
                  content={(props) => (
                    <DepartmentTooltip {...props} currency={currency} />
                  )}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="avgSalary"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

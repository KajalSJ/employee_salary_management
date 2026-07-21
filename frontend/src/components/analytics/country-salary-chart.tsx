"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  type LabelProps,
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
import type { CountryStats } from "@/lib/api/analytics";
import { formatCurrency } from "@/lib/format";

function CountryTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as CountryStats;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-sm">
      <p className="font-medium">{point.country}</p>
      <p className="text-muted-foreground">
        {formatCurrency(point.avgSalary, point.currency)} avg (
        {point.currency}) &middot; {point.headcount} employees
      </p>
    </div>
  );
}

export function CountrySalaryChart({ data }: { data: CountryStats[] }) {
  const sorted = [...data].sort((a, b) => a.country.localeCompare(b.country));

  function renderValueLabel(props: LabelProps) {
    const { x, y, width, value, index } = props;
    const row = typeof index === "number" ? sorted[index] : undefined;
    if (
      !row ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof width !== "number" ||
      typeof value !== "number"
    ) {
      return null;
    }
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        textAnchor="middle"
        fontSize={12}
        fontWeight={500}
        fill="var(--foreground)"
      >
        {formatCurrency(value, row.currency)}
      </text>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Average Salary by Country
        </CardTitle>
        <CardDescription>
          Shown in each country&apos;s own currency — not adjusted for
          exchange rates, so bar heights aren&apos;t directly comparable
          across countries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={sorted}
            margin={{ top: 24, right: 8, left: 8, bottom: 8 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="country"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis hide domain={[0, (max: number) => max * 1.15]} />
            <Tooltip content={CountryTooltip} cursor={{ fill: "var(--muted)" }} />
            <Bar
              dataKey="avgSalary"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={64}
            >
              <LabelList dataKey="avgSalary" content={renderValueLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

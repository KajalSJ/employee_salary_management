import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { average, median, round2, toNumber } from './analytics.util';

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

interface LatestSalaryRow {
  department: string;
  country: string;
  currency: string;
  amount: number;
}

interface RawLatestSalaryRow {
  department: string;
  country: string;
  currency: string;
  amount: unknown;
}

/**
 * Buckets are defined as "compa-ratio" bands (salary ÷ the median salary of
 * that employee's own currency) rather than absolute amounts. Employees are
 * paid in 5 different currencies with very different magnitudes (e.g. INR
 * numbers run ~10x USD ones), and this dataset has no real FX rate source —
 * bucketing raw amounts together, or fabricating a static FX rate for a
 * payroll tool, would both be misleading. Compa-ratio is the standard HR
 * comp-analytics way to compare pay position across currencies/geos without
 * currency conversion.
 */
const COMPA_RATIO_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '<75%', min: -Infinity, max: 0.75 },
  { label: '75-90%', min: 0.75, max: 0.9 },
  { label: '90-110%', min: 0.9, max: 1.1 },
  { label: '110-125%', min: 1.1, max: 1.25 },
  { label: '125-150%', min: 1.25, max: 1.5 },
  { label: '150%+', min: 1.5, max: Infinity },
];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<AnalyticsSummary> {
    const rows = await this.fetchLatestSalaries();

    return {
      headcount: rows.length,
      byDepartment: this.byDepartment(rows),
      byCountry: this.byCountry(rows),
      payrollCostByCurrency: this.payrollByCurrency(rows),
      salaryDistribution: this.compaRatioDistribution(rows),
    };
  }

  /**
   * One row per non-terminated employee: their most recent SalaryRecord.
   * Terminated employees are excluded — they're no longer on payroll, so
   * including their historical salary would overstate current headcount
   * and payroll cost (see EmployeesService.remove, which soft-deletes to
   * TERMINATED rather than dropping the row).
   */
  private async fetchLatestSalaries(): Promise<LatestSalaryRow[]> {
    const rows = await this.prisma.$queryRaw<RawLatestSalaryRow[]>`
      SELECT DISTINCT ON (sr."employeeId")
        e.department AS department,
        e.country AS country,
        sr.currency AS currency,
        sr.amount AS amount
      FROM "SalaryRecord" sr
      JOIN "Employee" e ON e.id = sr."employeeId"
      WHERE e.status != 'TERMINATED'
      ORDER BY sr."employeeId", sr."effectiveDate" DESC
    `;

    return rows.map((row) => ({
      department: row.department,
      country: row.country,
      currency: row.currency,
      amount: toNumber(row.amount),
    }));
  }

  private byDepartment(rows: LatestSalaryRow[]): DepartmentStats[] {
    const groups = this.groupBy(rows, (row) => row.department);
    return Array.from(groups.entries())
      .map(([department, items]) =>
        items.map((currencyItems) => ({
          department,
          ...this.stats(currencyItems),
        })),
      )
      .flat()
      .sort(
        (a, b) =>
          a.department.localeCompare(b.department) ||
          a.currency.localeCompare(b.currency),
      );
  }

  private byCountry(rows: LatestSalaryRow[]): CountryStats[] {
    const groups = this.groupBy(rows, (row) => row.country);
    return Array.from(groups.entries())
      .map(([country, items]) =>
        items.map((currencyItems) => ({
          country,
          ...this.stats(currencyItems),
        })),
      )
      .flat()
      .sort(
        (a, b) =>
          a.country.localeCompare(b.country) ||
          a.currency.localeCompare(b.currency),
      );
  }

  /** Groups rows by `keyFn`, then splits each group by currency. */
  private groupBy(
    rows: LatestSalaryRow[],
    keyFn: (row: LatestSalaryRow) => string,
  ): Map<string, LatestSalaryRow[][]> {
    const byKey = new Map<string, Map<string, LatestSalaryRow[]>>();
    for (const row of rows) {
      const key = keyFn(row);
      const byCurrency = byKey.get(key) ?? new Map<string, LatestSalaryRow[]>();
      const items = byCurrency.get(row.currency) ?? [];
      items.push(row);
      byCurrency.set(row.currency, items);
      byKey.set(key, byCurrency);
    }

    const result = new Map<string, LatestSalaryRow[][]>();
    for (const [key, byCurrency] of byKey) {
      result.set(key, Array.from(byCurrency.values()));
    }
    return result;
  }

  private stats(
    rows: LatestSalaryRow[],
  ): Pick<
    DepartmentStats,
    'currency' | 'headcount' | 'avgSalary' | 'medianSalary'
  > {
    const amounts = rows.map((row) => row.amount);
    return {
      currency: rows[0].currency,
      headcount: amounts.length,
      avgSalary: round2(average(amounts)),
      medianSalary: round2(median(amounts)),
    };
  }

  private payrollByCurrency(rows: LatestSalaryRow[]): PayrollCost[] {
    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amount);
    }
    return Array.from(totals.entries())
      .map(([currency, total]) => ({ currency, total: round2(total) }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
  }

  private compaRatioDistribution(
    rows: LatestSalaryRow[],
  ): DistributionBucket[] {
    const amountsByCurrency = new Map<string, number[]>();
    for (const row of rows) {
      const amounts = amountsByCurrency.get(row.currency) ?? [];
      amounts.push(row.amount);
      amountsByCurrency.set(row.currency, amounts);
    }

    const currencyMedians = new Map<string, number>();
    for (const [currency, amounts] of amountsByCurrency) {
      currencyMedians.set(currency, median(amounts));
    }

    const counts = COMPA_RATIO_BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: 0,
    }));

    for (const row of rows) {
      const currencyMedian = currencyMedians.get(row.currency);
      if (!currencyMedian) {
        continue;
      }
      const ratio = row.amount / currencyMedian;
      const bucketIndex = COMPA_RATIO_BUCKETS.findIndex(
        (bucket) => ratio >= bucket.min && ratio < bucket.max,
      );
      counts[bucketIndex === -1 ? counts.length - 1 : bucketIndex].count += 1;
    }

    return counts;
  }
}

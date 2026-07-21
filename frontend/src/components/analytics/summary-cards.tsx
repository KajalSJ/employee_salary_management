import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PayrollCost } from "@/lib/api/analytics";
import { formatCurrency, formatNumber } from "@/lib/format";

export function SummaryCards({
  headcount,
  payrollCostByCurrency,
}: {
  headcount: number;
  payrollCostByCurrency: PayrollCost[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <Card className="gap-2 p-4">
        <CardHeader className="p-0">
          <CardTitle>Total Headcount</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <p className="text-2xl font-semibold">{formatNumber(headcount)}</p>
        </CardContent>
      </Card>

      {payrollCostByCurrency.map((payroll) => (
        <Card key={payroll.currency} className="gap-2 p-4">
          <CardHeader className="p-0">
            <CardTitle>Total Payroll Cost ({payroll.currency})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-xl font-semibold break-words">
              {formatCurrency(payroll.total, payroll.currency)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSalaryRecord, type SalaryRecord } from "@/lib/api/employees";
import {
  ADDABLE_SALARY_REASONS,
  SALARY_REASON_LABELS,
} from "@/lib/constants/salary";
import { formatCurrency, formatDate } from "@/lib/format";

function sortByEffectiveDateDesc(records: SalaryRecord[]) {
  return [...records].sort((a, b) => {
    const byEffectiveDate =
      new Date(b.effectiveDate).getTime() -
      new Date(a.effectiveDate).getTime();
    if (byEffectiveDate !== 0) return byEffectiveDate;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const EMPTY_FORM = {
  amount: "",
  effectiveDate: "",
  reason: ADDABLE_SALARY_REASONS[0],
};

export function SalaryHistory({
  employeeId,
  records,
}: {
  employeeId: string;
  records: SalaryRecord[];
}) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const mutation = useMutation({
    mutationFn: () =>
      createSalaryRecord(employeeId, {
        amount: Number(form.amount),
        effectiveDate: form.effectiveDate,
        reason: form.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  function closeForm() {
    setIsFormOpen(false);
    setForm(EMPTY_FORM);
    mutation.reset();
  }

  const sorted = sortByEffectiveDateDesc(records);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Salary History</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (isFormOpen ? closeForm() : setIsFormOpen(true))}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add Salary Record
        </Button>
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="salary-amount"
              className="text-xs font-medium text-muted-foreground"
            >
              Amount
            </label>
            <Input
              id="salary-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-36"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="salary-effective-date"
              className="text-xs font-medium text-muted-foreground"
            >
              Effective Date
            </label>
            <Input
              id="salary-effective-date"
              type="date"
              required
              value={form.effectiveDate}
              onChange={(e) =>
                setForm({ ...form, effectiveDate: e.target.value })
              }
              className="w-40"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="salary-reason"
              className="text-xs font-medium text-muted-foreground"
            >
              Reason
            </label>
            <Select
              id="salary-reason"
              value={form.reason}
              onChange={(e) =>
                setForm({
                  ...form,
                  reason: e.target.value as typeof form.reason,
                })
              }
              className="w-40"
            >
              {ADDABLE_SALARY_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {SALARY_REASON_LABELS[reason]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={closeForm}>
              Cancel
            </Button>
          </div>

          {mutation.isError && (
            <p className="w-full text-sm text-destructive">
              Failed to add salary record. Please try again.
            </p>
          )}
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No salary history yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {sorted.map((record) => (
            <li
              key={record.id}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {formatCurrency(record.amount, record.currency)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(record.effectiveDate)}
                </p>
              </div>
              <Badge variant="secondary">
                {SALARY_REASON_LABELS[record.reason]}
              </Badge>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

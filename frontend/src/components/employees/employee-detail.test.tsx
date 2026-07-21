import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { EmployeeDetail } from "./employee-detail";
import type { EmployeeDetail as EmployeeDetailType, SalaryRecord } from "@/lib/api/employees";

function renderWithClient(id: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EmployeeDetail id={id} />
    </QueryClientProvider>
  );
}

function makeSalaryRecord(overrides: Partial<SalaryRecord> = {}): SalaryRecord {
  return {
    id: "sal-1",
    employeeId: "1",
    amount: "90000.00",
    currency: "GBP",
    effectiveDate: "2024-01-01",
    reason: "JOINING",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeEmployee(
  overrides: Partial<EmployeeDetailType> = {}
): EmployeeDetailType {
  return {
    id: "1",
    name: "Ada Lovelace",
    email: "ada@acme.com",
    department: "Engineering",
    country: "United Kingdom",
    currency: "GBP",
    jobTitle: "Software Engineer",
    status: "ACTIVE",
    hireDate: "2024-01-01",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
    salaryRecords: [makeSalaryRecord()],
    ...overrides,
  };
}

function mockResponse<T>(body: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("EmployeeDetail", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders employee profile info", async () => {
    fetchMock.mockResolvedValue(mockResponse(makeEmployee({ salaryRecords: [] })));

    renderWithClient("1");

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@acme.com")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("United Kingdom")).toBeInTheDocument();
    expect(screen.getByText("Software Engineer")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("January 1, 2024")).toBeInTheDocument();
  });

  it("renders salary history in correct order, most recent first", async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        makeEmployee({
          salaryRecords: [
            makeSalaryRecord({
              id: "sal-1",
              amount: "80000.00",
              effectiveDate: "2022-01-01",
              reason: "JOINING",
            }),
            makeSalaryRecord({
              id: "sal-2",
              amount: "88000.00",
              effectiveDate: "2023-01-01",
              reason: "HIKE",
            }),
            makeSalaryRecord({
              id: "sal-3",
              amount: "95000.00",
              effectiveDate: "2024-01-01",
              reason: "PROMOTION",
            }),
          ],
        })
      )
    );

    renderWithClient("1");

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(3);

    // Most recent effectiveDate first.
    expect(within(items[0]).getByText("Promotion")).toBeInTheDocument();
    expect(within(items[0]).getByText("January 1, 2024")).toBeInTheDocument();

    expect(within(items[1]).getByText("Hike")).toBeInTheDocument();
    expect(within(items[1]).getByText("January 1, 2023")).toBeInTheDocument();

    expect(within(items[2]).getByText("Joining")).toBeInTheDocument();
    expect(within(items[2]).getByText("January 1, 2022")).toBeInTheDocument();
  });

  it("shows a not-found state when the employee doesn't exist", async () => {
    fetchMock.mockResolvedValue(mockResponse({ message: "Not Found" }, 404));

    renderWithClient("missing-id");

    expect(await screen.findByText("Employee not found")).toBeInTheDocument();
    expect(
      screen.getByText("This employee doesn't exist or may have been removed.")
    ).toBeInTheDocument();
  });

  it("submits a new salary record without touching past records", async () => {
    const originalRecord = makeSalaryRecord({ id: "sal-1", reason: "JOINING" });
    const newRecord = makeSalaryRecord({
      id: "sal-2",
      amount: "100000.00",
      effectiveDate: "2025-01-01",
      reason: "HIKE",
    });
    let salaryCreated = false;

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/salaries")) {
        salaryCreated = true;
        return Promise.resolve(mockResponse(newRecord));
      }
      return Promise.resolve(
        mockResponse(
          makeEmployee({
            salaryRecords: salaryCreated
              ? [originalRecord, newRecord]
              : [originalRecord],
          })
        )
      );
    });

    renderWithClient("1");

    await screen.findByText("Ada Lovelace");
    fireEvent.click(screen.getByRole("button", { name: "Add Salary Record" }));

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "100000" },
    });
    fireEvent.change(screen.getByLabelText("Effective Date"), {
      target: { value: "2025-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "HIKE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("/salaries"))
      ).toBe(true)
    );

    const [, requestInit] = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/salaries")
    )!;
    expect(requestInit).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        amount: 100000,
        effectiveDate: "2025-01-01",
        reason: "HIKE",
      }),
    });

    // The original JOINING record is still present — the form only adds,
    // never edits/replaces past records.
    await screen.findByText("£100,000.00");
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
  });
});

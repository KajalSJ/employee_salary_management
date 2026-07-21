import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AnalyticsDashboard } from "./analytics-dashboard";
import type { AnalyticsSummary } from "@/lib/api/analytics";

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AnalyticsDashboard />
    </QueryClientProvider>
  );
}

function makeSummary(overrides: Partial<AnalyticsSummary> = {}): AnalyticsSummary {
  return {
    headcount: 2,
    byDepartment: [
      {
        department: "Engineering",
        currency: "USD",
        headcount: 1,
        avgSalary: 100000,
        medianSalary: 100000,
      },
      {
        department: "Engineering",
        currency: "INR",
        headcount: 1,
        avgSalary: 1200000,
        medianSalary: 1200000,
      },
    ],
    byCountry: [
      {
        country: "United States",
        currency: "USD",
        headcount: 1,
        avgSalary: 100000,
        medianSalary: 100000,
      },
      {
        country: "India",
        currency: "INR",
        headcount: 1,
        avgSalary: 1200000,
        medianSalary: 1200000,
      },
    ],
    payrollCostByCurrency: [
      { currency: "USD", total: 100000 },
      { currency: "INR", total: 1200000 },
    ],
    salaryDistribution: [
      { label: "<75%", count: 0 },
      { label: "75-90%", count: 0 },
      { label: "90-110%", count: 2 },
      { label: "110-125%", count: 0 },
      { label: "125-150%", count: 0 },
      { label: "150%+", count: 0 },
    ],
    ...overrides,
  };
}

function mockResponse<T>(body: T) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe("AnalyticsDashboard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders summary cards from mock API data", async () => {
    fetchMock.mockResolvedValue(mockResponse(makeSummary()));

    renderWithClient();

    expect(await screen.findByText("Total Headcount")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    expect(screen.getByText("Total Payroll Cost (USD)")).toBeInTheDocument();
    expect(screen.getByText("$100,000.00")).toBeInTheDocument();

    expect(screen.getByText("Total Payroll Cost (INR)")).toBeInTheDocument();
    expect(screen.getByText("₹1,200,000.00")).toBeInTheDocument();
  });

  it("shows a loading state before data arrives", () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithClient();

    expect(screen.queryByText("Total Headcount")).not.toBeInTheDocument();
  });

  it("shows an empty state when there is no salary data", async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        makeSummary({
          headcount: 0,
          byDepartment: [],
          byCountry: [],
          payrollCostByCurrency: [],
          salaryDistribution: [],
        })
      )
    );

    renderWithClient();

    expect(
      await screen.findByText("No salary data available.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Total Headcount")).not.toBeInTheDocument();
  });
});

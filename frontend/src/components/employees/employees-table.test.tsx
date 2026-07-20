import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { EmployeesTable } from "./employees-table";
import type { Employee, PaginatedResult } from "@/lib/api/employees";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EmployeesTable />
    </QueryClientProvider>
  );
}

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
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
    ...overrides,
  };
}

function mockResponse(result: PaginatedResult<Employee>) {
  return {
    ok: true,
    status: 200,
    json: async () => result,
  } as Response;
}

function emptyResult(): PaginatedResult<Employee> {
  return { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } };
}

function lastFetchedUrl(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.at(-1);
  return call?.[0] as string;
}

describe("EmployeesTable", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders rows from mock data", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        data: [
          makeEmployee(),
          makeEmployee({
            id: "2",
            name: "Grace Hopper",
            email: "grace@acme.com",
            department: "Product",
            country: "United States",
            jobTitle: "Product Manager",
            status: "INACTIVE",
          }),
        ],
        meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      })
    );

    renderWithClient();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();

    // Scoped to the table body: several of these values (department,
    // country, status) also appear as <option> text in the filter
    // dropdowns, so an unscoped query would match twice.
    const table = screen.getByRole("table");
    expect(within(table).getByText("ada@acme.com")).toBeInTheDocument();
    expect(within(table).getByText("Engineering")).toBeInTheDocument();
    expect(within(table).getByText("United Kingdom")).toBeInTheDocument();
    expect(within(table).getByText("Software Engineer")).toBeInTheDocument();
    expect(within(table).getByText("ACTIVE")).toBeInTheDocument();

    expect(within(table).getByText("Grace Hopper")).toBeInTheDocument();
    expect(within(table).getByText("INACTIVE")).toBeInTheDocument();
  });

  it("shows an empty state when there are no results", async () => {
    fetchMock.mockResolvedValue(mockResponse(emptyResult()));

    renderWithClient();

    expect(await screen.findByText("No employees found.")).toBeInTheDocument();
  });

  it("debounces the search input and triggers a single call with the search param", async () => {
    fetchMock.mockResolvedValue(mockResponse(emptyResult()));

    renderWithClient();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const searchInput = screen.getByLabelText("Search by name");
    fireEvent.change(searchInput, { target: { value: "a" } });
    fireEvent.change(searchInput, { target: { value: "ad" } });
    fireEvent.change(searchInput, { target: { value: "ada" } });

    // Debounce window hasn't elapsed yet — no new call.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), {
      timeout: 1000,
    });

    const url = lastFetchedUrl(fetchMock);
    expect(url).toContain("search=ada");
    expect(url).toContain("page=1");
  });

  it("triggers a refetch with the correct params when a filter changes", async () => {
    fetchMock.mockResolvedValue(mockResponse(emptyResult()));

    renderWithClient();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastFetchedUrl(fetchMock)).not.toContain("department=");

    fireEvent.change(screen.getByLabelText("Filter by department"), {
      target: { value: "Engineering" },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const url = lastFetchedUrl(fetchMock);
    expect(url).toContain("department=Engineering");
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=20");
  });
});

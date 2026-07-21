import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { AuthGuard } from "./auth-guard";
import { AuthProvider } from "@/lib/auth/auth-context";
import { setToken } from "@/lib/auth/token";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

function mockResponse<T>(body: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderGuarded() {
  return render(
    <AuthProvider>
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    </AuthProvider>
  );
}

describe("AuthGuard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
    replaceMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to /login when there is no stored token", async () => {
    renderGuarded();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to /login when the stored token is no longer valid", async () => {
    setToken("stale-token");
    fetchMock.mockResolvedValue(mockResponse({ message: "Unauthorized" }, 401));

    renderGuarded();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders children once a valid token is confirmed", async () => {
    setToken("tok-123");
    fetchMock.mockResolvedValue(
      mockResponse({
        id: "1",
        email: "hr@acme.com",
        name: "HR Manager",
        createdAt: "2024-01-01",
      })
    );

    renderGuarded();

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

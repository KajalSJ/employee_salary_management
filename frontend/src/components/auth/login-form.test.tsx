import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LoginForm } from "./login-form";
import { AuthProvider } from "@/lib/auth/auth-context";
import { getToken } from "@/lib/auth/token";

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

function renderLoginForm() {
  return render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}

describe("LoginForm", () => {
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

  it("logs in and redirects to /employees on success", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/login")) {
        return Promise.resolve(mockResponse({ accessToken: "tok-123" }));
      }
      if (url.includes("/auth/me")) {
        return Promise.resolve(
          mockResponse({
            id: "1",
            email: "hr@acme.com",
            name: "HR Manager",
            createdAt: "2024-01-01",
          })
        );
      }
      return Promise.resolve(mockResponse({}, 404));
    });

    renderLoginForm();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "hr@acme.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/employees"));
    expect(getToken()).toBe("tok-123");
  });

  it("shows an error message on invalid credentials and does not redirect", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/login")) {
        return Promise.resolve(
          mockResponse({ message: "Invalid email or password" }, 401)
        );
      }
      return Promise.resolve(mockResponse({}, 404));
    });

    renderLoginForm();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "hr@acme.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Invalid email or password.")
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(getToken()).toBeNull();
  });
});

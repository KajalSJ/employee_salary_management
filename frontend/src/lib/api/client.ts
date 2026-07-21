import { clearToken, getToken } from "@/lib/auth/token";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const UNAUTHORIZED_EVENT = "auth:unauthorized";

// Central fetch wrapper for every authenticated endpoint (employees, salaries,
// analytics, /auth/me) — attaches the stored bearer token and, on a 401 from
// a call that *did* send a token, treats it as an expired/invalidated session
// rather than a one-off error: clears the token and notifies AuthProvider so
// the UI can drop back to the login screen instead of re-showing a dead
// "please try again" error state.
export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && token) {
    clearToken();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  return res;
}

export function onUnauthorized(listener: () => void): () => void {
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, listener);
}

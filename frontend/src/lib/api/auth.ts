import { apiFetch, ApiError } from "@/lib/api/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function login({
  email,
  password,
}: LoginInput): Promise<{ accessToken: string }> {
  // Deliberately plain `fetch`, not `apiFetch` — there's no token yet, and a
  // 401 here means "wrong password," not "session expired," so it must not
  // trigger apiFetch's clear-token-and-broadcast-logout behavior.
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new ApiError("Invalid email or password", res.status);
  }

  return res.json();
}

export async function fetchMe(signal?: AbortSignal): Promise<AuthenticatedUser> {
  const res = await apiFetch("/api/auth/me", { signal });

  if (!res.ok) {
    throw new ApiError(`Failed to fetch current user (${res.status})`, res.status);
  }

  return res.json();
}

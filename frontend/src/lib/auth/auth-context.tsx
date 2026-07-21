"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { fetchMe, login as loginRequest, type AuthenticatedUser } from "@/lib/api/auth";
import { onUnauthorized } from "@/lib/api/client";
import { clearToken, getToken, setToken } from "@/lib/auth/token";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // No stored token means there's nothing to verify — start at
  // "unauthenticated" directly instead of setState-ing to it from inside the
  // effect below (a token *does* need the effect, since confirming it against
  // the backend is necessarily async).
  const [status, setStatus] = useState<AuthStatus>(() =>
    getToken() ? "loading" : "unauthenticated"
  );
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // Verifies the stored token against the backend on every app load rather
  // than trusting its presence — a token can outlive the HRUser row it was
  // issued for (see the backend's JwtStrategy.validate() decision) or simply
  // expire, and either case should drop straight to unauthenticated.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetchMe()
      .then((me) => {
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        clearToken();
        setStatus("unauthenticated");
      });
  }, []);

  useEffect(() => onUnauthorized(logout), [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await loginRequest({ email, password });
    setToken(accessToken);
    const me = await fetchMe();
    setUser(me);
    setStatus("authenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

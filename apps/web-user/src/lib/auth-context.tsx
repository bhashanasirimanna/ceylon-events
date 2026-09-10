"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch, getStoredTokens, setStoredTokens } from "./api-client";
import type { AuthTokens, CurrentUser } from "./types";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!tokens?.accessToken) {
      setIsLoading(false);
      return;
    }
    apiFetch<CurrentUser>("/auth/me")
      .then((me) => setUser(me))
      .catch(() => setStoredTokens(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<{ user: CurrentUser; tokens: AuthTokens }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    setStoredTokens(result.tokens);
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      const result = await apiFetch<{
        user: CurrentUser;
        tokens: AuthTokens;
      }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName }),
      });
      setStoredTokens(result.tokens);
      setUser(result.user);
    },
    [],
  );

  const logout = useCallback(() => {
    setStoredTokens(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

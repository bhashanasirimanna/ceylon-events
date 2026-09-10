"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  apiFetch,
  clearTokens,
  loadTokens,
  saveTokens,
  type AuthTokens,
} from "./api-client";
import type { UserResponse } from "./types";

interface LoginResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

interface AuthContextValue {
  user: UserResponse | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens?.accessToken) {
      setIsLoading(false);
      return;
    }
    apiFetch<UserResponse | null>("/auth/me")
      .then((me) => setUser(me))
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<LoginResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      { auth: false },
    );
    saveTokens(result.tokens);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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

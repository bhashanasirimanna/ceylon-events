"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, getStoredTokens, setStoredTokens } from "./api-client";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  restaurantId: string | null;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!tokens) {
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
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    setStoredTokens({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    setStoredTokens(null);
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

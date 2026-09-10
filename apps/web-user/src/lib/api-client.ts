const TOKENS_KEY = "ceylon_user_tokens";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getStoredTokens(): StoredTokens | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: StoredTokens | null): void {
  if (typeof window === "undefined") return;
  if (tokens) {
    window.localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } else {
    window.localStorage.removeItem(TOKENS_KEY);
  }
}

const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api`;

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const tokens = getStoredTokens();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : null) ?? `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

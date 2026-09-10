const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api`;
const TOKENS_KEY = "ceylon_restaurant_tokens";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
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
  if (!tokens) {
    window.localStorage.removeItem(TOKENS_KEY);
  } else {
    window.localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === HttpNoContent) {
    return undefined as T;
  }

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message =
      (body && (body.message as string)) ??
      `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return body as T;
}

const HttpNoContent = 204;

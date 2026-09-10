export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const TOKENS_KEY = "ceylon_admin_tokens";

export function loadTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: AuthTokens): void {
  window.localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  window.localStorage.removeItem(TOKENS_KEY);
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

function apiBaseUrl(): string {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000"}/api`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  opts: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (opts.auth !== false) {
    const tokens = loadTokens();
    if (tokens?.accessToken) {
      headers.set("Authorization", `Bearer ${tokens.accessToken}`);
    }
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  const isNoContent = response.status === 204;
  const body = isNoContent
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : undefined) ?? `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return body as T;
}

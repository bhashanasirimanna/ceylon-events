import type { CeylonEnv } from "./env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thin wrapper around the api-gateway, mirroring the frontend apps' own
 * apiFetch helper so request/response handling is consistent with how the
 * real system is actually driven. */
export function makeApi(env: CeylonEnv, accessToken?: string) {
  const base = `http://localhost:${env.apiGatewayPort}/api`;

  // identity-service throttles its /auth/* endpoints tightly (10/min per
  // IP) to blunt credential-stuffing — a seed run legitimately makes many
  // register/login calls in quick succession, so a 429 here just means
  // "wait out the window and retry," not a real failure.
  async function call(path: string, init: RequestInit = {}, attempt = 1): Promise<any> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    const res = await fetch(`${base}${path}`, { ...init, headers });
    if (res.status === 429 && attempt <= 5) {
      const retryAfterHeader = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : 7000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return call(path, init, attempt + 1);
    }
    if (res.status === 204) return undefined;
    const body: any = await res.json().catch(() => undefined);
    if (!res.ok) {
      const message = body?.message ?? `Request failed with status ${res.status}`;
      throw new ApiError(res.status, Array.isArray(message) ? message.join("; ") : message);
    }
    return body;
  }

  return {
    get: (path: string) => call(path, { method: "GET" }),
    post: (path: string, body?: unknown) =>
      call(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
    patch: (path: string, body?: unknown) =>
      call(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  };
}

export type Api = ReturnType<typeof makeApi>;

export interface LoginResult {
  user: { id: string; email: string; fullName: string; roles: string[]; restaurantId: string | null };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

export async function login(env: CeylonEnv, email: string, password: string): Promise<LoginResult> {
  return makeApi(env).post("/auth/login", { email, password });
}

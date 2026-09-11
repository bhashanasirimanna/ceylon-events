import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Repo-root .env, loaded manually (no dotenv dependency) so this works the
// same way whether it's run via `pnpm reset:db`/`pnpm seed` from the repo
// root or invoked directly with `tsx scripts/reset-db.ts`.
const ENV_PATH = resolve(__dirname, "../../.env");

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) {
    throw new Error(`Expected a .env file at ${path} — copy .env.example first.`);
  }
  const values: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const fileEnv = loadDotEnv(ENV_PATH);

// process.env wins over the file, same precedence a shell export would
// give you, so `NODE_ENV=production pnpm reset:db` still gets caught even
// if .env itself says development.
function get(name: string): string | undefined {
  return process.env[name] ?? fileEnv[name];
}

export interface CeylonEnv {
  nodeEnv: string;
  postgresHost: string;
  postgresPort: number;
  postgresUser: string;
  postgresPassword: string;
  apiGatewayPort: number;
  internalServiceSecret: string;
  // The api-gateway has no route for /internal/* at all (it's not a
  // public-facing prefix — see proxy.service.ts's ROUTES table) so
  // internal-only calls go straight to each service's own host-mapped
  // port instead of through the gateway, the same way these services
  // call each other over the docker network.
  orderServicePort: number;
  venueServicePort: number;
  notificationServicePort: number;
  minio: {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
}

export function loadEnv(): CeylonEnv {
  const nodeEnv = get("NODE_ENV") ?? "";
  const postgresHost = get("POSTGRES_HOST") ?? "";
  const postgresPort = Number(get("POSTGRES_PORT") ?? "5432");
  const postgresUser = get("POSTGRES_USER");
  const postgresPassword = get("POSTGRES_PASSWORD");
  const apiGatewayPort = Number(get("API_GATEWAY_PORT") ?? "3000");
  const internalServiceSecret = get("INTERNAL_SERVICE_SECRET");

  if (!postgresUser || !postgresPassword) {
    throw new Error(
      "POSTGRES_USER / POSTGRES_PASSWORD missing from .env — refusing to guess credentials.",
    );
  }
  if (!internalServiceSecret) {
    throw new Error("INTERNAL_SERVICE_SECRET missing from .env.");
  }

  return {
    nodeEnv,
    postgresHost,
    postgresPort,
    postgresUser,
    postgresPassword,
    apiGatewayPort,
    internalServiceSecret,
    orderServicePort: Number(get("ORDER_SERVICE_PORT") ?? "3006"),
    venueServicePort: Number(get("VENUE_SERVICE_PORT") ?? "3004"),
    notificationServicePort: Number(get("NOTIFICATION_SERVICE_PORT") ?? "3012"),
    minio: {
      endpoint: get("MINIO_ENDPOINT") ?? "minio",
      port: Number(get("MINIO_PORT") ?? "9000"),
      useSSL: (get("MINIO_USE_SSL") ?? "false").toLowerCase() === "true",
      accessKey: get("MINIO_ROOT_USER") ?? "",
      secretKey: get("MINIO_ROOT_PASSWORD") ?? "",
      bucket: get("MEDIA_BUCKET") ?? "ceylon-media",
    },
  };
}

const ALLOWED_DEV_HOSTS = new Set(["postgres", "localhost", "127.0.0.1"]);

/**
 * The one thing standing between this script and accidentally truncating
 * a real database: refuses to run unless NODE_ENV is explicitly a non-
 * production value AND POSTGRES_HOST resolves to the local docker-compose
 * Postgres (its in-network hostname, or localhost/127.0.0.1 if someone's
 * pointed .env at a bare-metal local install instead). Anything else —
 * including simply being unset — refuses.
 */
export function assertSafeToResetOrSeed(env: CeylonEnv): void {
  const problems: string[] = [];

  if (!env.nodeEnv) {
    problems.push("NODE_ENV is not set in .env");
  } else if (env.nodeEnv.toLowerCase() === "production") {
    problems.push("NODE_ENV=production");
  }

  if (!ALLOWED_DEV_HOSTS.has(env.postgresHost)) {
    problems.push(
      `POSTGRES_HOST="${env.postgresHost}" is not one of the recognized local dev hosts (${[...ALLOWED_DEV_HOSTS].join(", ")})`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      [
        "Refusing to run — this does not look like the local docker-compose dev environment:",
        ...problems.map((p) => `  - ${p}`),
        "This script is destructive (reset) or creates a large volume of test data (seed) and must never run against a shared or production database.",
      ].join("\n"),
    );
  }
}

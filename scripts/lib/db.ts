import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// The 11 databases actually owned by a service (per docker-compose.yml).
// media_db and reporting_db exist in Postgres (created by
// infra/postgres/init/*.sh "just in case") but no service ever connects
// to them — media-service is MinIO-only and reporting-service is a
// stateless HTTP aggregator — so they're deliberately left out here.
export const SERVICE_DATABASES = [
  "identity_db",
  "restaurant_db",
  "venue_db",
  "event_db",
  "order_db",
  "payment_db",
  "checkin_db",
  "food_order_db",
  "offers_db",
  "rating_db",
  "notification_db",
] as const;

/**
 * Every database query in this script runs through `docker compose exec
 * postgres psql`, not a direct TCP connection to the host-published 5432
 * — this machine has a second, unrelated PostgreSQL server already bound
 * to host port 5432 (confirmed via `Get-NetTCPConnection`: port 5432 is
 * held by a native `postgres` process, not Docker's own port-forwarding
 * pair of com.docker.backend+wslrelay that 3000/9000 show), so a plain
 * `localhost:5432` connection from the host silently talks to the wrong
 * server. Going through `docker compose exec` instead uses Docker's own
 * control channel, not host TCP, so it always reaches the right
 * container regardless of that conflict — and as a side effect, it's
 * also physically incapable of ever reaching a remote/production
 * database, which only strengthens the dev-only guard rail elsewhere in
 * this script.
 */
async function psql(database: string, sql: string): Promise<string> {
  const { stdout } = await execFileAsync("docker", [
    "compose",
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "ceylon",
    "-d",
    database,
    "-t", // tuples only — no header/footer
    "-A", // unaligned — no column padding
    "-F",
    "\t",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]);
  return stdout;
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/** Turns JS values into SQL literals for the handful of hand-built
 * statements in this script (all values are either this script's own
 * fixed seed constants or UUIDs it already validated shape of earlier —
 * never raw end-user input). */
export function sqlLiteral(value: string | number | boolean | string[] | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return `ARRAY[${value.map((v) => `'${escapeSqlString(v)}'`).join(", ")}]`;
  }
  return `'${escapeSqlString(value)}'`;
}

/**
 * Read-only lookups against a service's own database, used purely to make
 * the seed script idempotent (find an already-seeded row by its natural
 * key before deciding whether to call the real create endpoint again).
 * Every actual write still goes through the service's own HTTP API —
 * this never INSERTs/UPDATEs anything except the one-time SUPER_ADMIN
 * bootstrap and the owner/staff password normalization, both of which
 * have no equivalent API path (see seed/bootstrap-admin.ts and
 * seed/identity.ts for why).
 *
 * `columns` must list the SELECTed columns in the exact order the SQL
 * selects them — psql's unaligned output has no reliable machine-
 * readable column-name header, so this script always knows in advance
 * what it asked for.
 */
export async function queryOne(
  database: string,
  sql: string,
  columns: string[],
): Promise<Record<string, string> | null> {
  const stdout = await psql(database, sql);
  const firstLine = stdout.split("\n").find((line) => line.length > 0);
  if (!firstLine) return null;
  const values = firstLine.split("\t");
  const row: Record<string, string> = {};
  columns.forEach((col, i) => {
    row[col] = values[i] ?? "";
  });
  return row;
}

export async function queryMany(
  database: string,
  sql: string,
  columns: string[],
): Promise<Record<string, string>[]> {
  const stdout = await psql(database, sql);
  return stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const values = line.split("\t");
      const row: Record<string, string> = {};
      columns.forEach((col, i) => {
        row[col] = values[i] ?? "";
      });
      return row;
    });
}

export async function execSql(database: string, sql: string): Promise<void> {
  await psql(database, sql);
}

/**
 * One TRUNCATE ... RESTART IDENTITY CASCADE statement listing every base
 * table in the database at once. Doing it as a single multi-table
 * statement is what makes this "dependency-safe order" free — Postgres
 * resolves all the FK relationships between the listed tables itself in
 * one pass, so there's no need to hand-sort tables per service.
 */
export async function truncateAllTables(database: string): Promise<string[]> {
  const tables = (
    await queryMany(database, `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`, ["tablename"])
  ).map((r) => r.tablename);
  if (tables.length === 0) {
    return [];
  }
  const quoted = tables.map((t) => `"${t}"`).join(", ");
  await execSql(database, `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  return tables;
}

/**
 * Dev-only full reset: wipes every row in every service database while
 * leaving the schema (tables/columns/indexes) exactly as TypeORM's
 * `synchronize` already created it — no migrations exist in this repo
 * (confirmed: `find . -iname "*migration*"` turns up nothing), so
 * "re-run migrations from scratch" isn't an available option here;
 * TRUNCATE is the reset mechanism instead.
 *
 * Runs entirely through `docker compose exec postgres psql` (see
 * lib/db.ts) rather than a host TCP connection — this dev machine has an
 * unrelated native PostgreSQL server already bound to host port 5432, so
 * a plain `localhost:5432` connection would silently hit the wrong
 * server. `docker compose` up must already be running.
 *
 * Usage:  pnpm reset:db
 */
import { assertSafeToResetOrSeed, loadEnv } from "./lib/env";
import { SERVICE_DATABASES, truncateAllTables } from "./lib/db";

async function main() {
  const env = loadEnv();
  assertSafeToResetOrSeed(env);

  console.log(
    `Resetting ${SERVICE_DATABASES.length} databases in the docker-compose Postgres container (NODE_ENV=${env.nodeEnv})…`,
  );

  for (const database of SERVICE_DATABASES) {
    const tables = await truncateAllTables(database);
    console.log(
      tables.length > 0
        ? `  ${database}: truncated ${tables.length} table(s)`
        : `  ${database}: no tables yet (service never started against it)`,
    );
  }

  console.log("Done. Every service database is now empty (schema intact).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

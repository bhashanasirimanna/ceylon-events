/**
 * Fails fast with a clear message when a service is missing a required
 * environment variable, instead of limping along into a confusing
 * downstream error (e.g. TypeORM's opaque connection failure when
 * DATABASE_URL is undefined, or silently issuing JWTs signed with the
 * "dev_access_secret_change_me" fallback in a real deployment). Call this
 * as the very first line of main.ts, before NestFactory.create.
 */
export function requireEnv(names: string[]): void {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `Refusing to start: missing required environment variable(s): ${missing.join(", ")}`,
    );
    process.exit(1);
  }
}

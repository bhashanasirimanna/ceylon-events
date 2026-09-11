import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { CeylonEnv } from "../lib/env";
import { execSql, queryOne, sqlLiteral } from "../lib/db";
import { login } from "../lib/http";
import { SUPER_ADMIN } from "./data";

const SALT_ROUNDS = 10; // matches identity-service's own auth.service.ts

/**
 * The one and only direct database write in this whole seed script (the
 * password-normalization update in seed/identity.ts is the other, for a
 * related reason). Every other account (owners, staff, customers) is
 * created through the real `/auth/*` endpoints — but there is no
 * endpoint that can create the very first SUPER_ADMIN from an empty
 * database (register always makes a CUSTOMER, and both invite endpoints
 * require an already-authenticated SUPER_ADMIN/ADMIN caller). This
 * mirrors exactly what identity-service's own AuthService.register would
 * have produced for this user.
 */
export async function ensureSuperAdmin(env: CeylonEnv): Promise<{ accessToken: string }> {
  const existing = await queryOne("identity_db", `SELECT id FROM users WHERE email = ${sqlLiteral(SUPER_ADMIN.email)}`, [
    "id",
  ]);

  if (!existing) {
    const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, SALT_ROUNDS);
    await execSql(
      "identity_db",
      `INSERT INTO users (id, email, password_hash, full_name, roles, is_active)
       VALUES (${sqlLiteral(randomUUID())}, ${sqlLiteral(SUPER_ADMIN.email)}, ${sqlLiteral(passwordHash)}, ${sqlLiteral(SUPER_ADMIN.fullName)}, ${sqlLiteral(["SUPER_ADMIN"])}, true)`,
    );
    console.log(`  identity: bootstrapped super admin ${SUPER_ADMIN.email}`);
  } else {
    console.log(`  identity: super admin ${SUPER_ADMIN.email} already exists`);
  }

  const { tokens } = await login(env, SUPER_ADMIN.email, SUPER_ADMIN.password);
  return { accessToken: tokens.accessToken };
}

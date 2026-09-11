import bcrypt from "bcryptjs";
import type { CeylonEnv } from "../lib/env";
import { execSql, queryOne, sqlLiteral } from "../lib/db";
import { login, makeApi, type Api } from "../lib/http";
import { CUSTOMERS, RESTAURANTS, SEED_PASSWORD } from "./data";

const SALT_ROUNDS = 10;

/**
 * invite-restaurant-owner/-staff always issue a fresh random tempPassword
 * (or, for the owner-invite variant, no password at all until
 * accept-invite is used) — there's no way to make that deterministic
 * through the API alone. So every owner/staff account gets its password
 * normalized to SEED_PASSWORD right after creation (or immediately, if it
 * already existed from a previous run) via a direct update — the account
 * itself is always created through the real invite endpoint; only the
 * password is forced afterward so re-running this script logs in with a
 * password you can actually predict, both this run and the next.
 */
async function normalizePassword(email: string): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);
  await execSql(
    "identity_db",
    `UPDATE users SET password_hash = ${sqlLiteral(passwordHash)}, is_active = true WHERE email = ${sqlLiteral(email)}`,
  );
}

async function userExists(email: string): Promise<boolean> {
  const row = await queryOne("identity_db", `SELECT id FROM users WHERE email = ${sqlLiteral(email)}`, ["id"]);
  return row !== null;
}

export interface SeededOwner {
  email: string;
  password: string;
  api: Api;
  restaurantIndex: number;
}

export async function seedRestaurantStaffAccounts(
  env: CeylonEnv,
  adminApi: Api,
): Promise<{ owners: SeededOwner[]; restaurantOwnerEmails: string[] }> {
  const owners: SeededOwner[] = [];

  for (let i = 0; i < RESTAURANTS.length; i++) {
    const r = RESTAURANTS[i];
    const restaurantId = await getRestaurantIdByName(r.name);
    if (!restaurantId) {
      throw new Error(`Expected restaurant "${r.name}" to already be seeded before its staff`);
    }

    if (!(await userExists(r.owner.email))) {
      await adminApi.post("/auth/invite-restaurant-staff", {
        email: r.owner.email,
        fullName: r.owner.fullName,
        restaurantId,
        role: "RESTAURANT_OWNER",
      });
      console.log(`  identity: invited owner ${r.owner.email} for ${r.name}`);
    }
    await normalizePassword(r.owner.email);

    for (const staff of r.staff) {
      if (!(await userExists(staff.email))) {
        await adminApi.post("/auth/invite-restaurant-staff", {
          email: staff.email,
          fullName: staff.fullName,
          restaurantId,
          role: "RESTAURANT_STAFF",
        });
        console.log(`  identity: invited staff ${staff.email} for ${r.name}`);
      }
      await normalizePassword(staff.email);
    }

    const { tokens } = await login(env, r.owner.email, SEED_PASSWORD);
    owners.push({
      email: r.owner.email,
      password: SEED_PASSWORD,
      api: makeApi(env, tokens.accessToken),
      restaurantIndex: i,
    });
  }

  return { owners, restaurantOwnerEmails: RESTAURANTS.map((r) => r.owner.email) };
}

export interface SeededCustomer {
  id: string;
  email: string;
  fullName: string;
  api: Api;
}

export async function seedCustomers(env: CeylonEnv): Promise<SeededCustomer[]> {
  const customers: SeededCustomer[] = [];
  for (const c of CUSTOMERS) {
    if (!(await userExists(c.email))) {
      await makeApi(env).post("/auth/register", {
        email: c.email,
        password: SEED_PASSWORD,
        fullName: c.fullName,
      });
      console.log(`  identity: registered customer ${c.email}`);
    }
    const { user, tokens } = await login(env, c.email, SEED_PASSWORD);
    customers.push({
      id: user.id,
      email: c.email,
      fullName: c.fullName,
      api: makeApi(env, tokens.accessToken),
    });
  }
  return customers;
}

// Shared with restaurants.ts — kept here too since identity.ts needs it to
// resolve restaurantId before the owner/staff can be invited into it.
export async function getRestaurantIdByName(name: string): Promise<string | null> {
  const row = await queryOne("restaurant_db", `SELECT id FROM restaurants WHERE name = ${sqlLiteral(name)}`, ["id"]);
  return row?.id ?? null;
}

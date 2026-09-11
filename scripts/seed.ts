/**
 * Dev-only realistic seed data across every service, in dependency order.
 * Every write goes through each service's real HTTP API (via the api
 * gateway) except the one-time SUPER_ADMIN bootstrap, which has no API
 * path from an empty database (see seed/bootstrap-admin.ts). Read-only
 * SQL lookups are used purely to make re-running this idempotent — see
 * scripts/lib/db.ts's queryOne doc comment.
 *
 * Usage:  pnpm seed   (after `pnpm reset:db`, or on top of already-seeded data)
 */
import { assertSafeToResetOrSeed, loadEnv } from "./lib/env";
import { makeApi } from "./lib/http";
import { ensureSuperAdmin } from "./seed/bootstrap-admin";
import { seedCustomers, seedRestaurantStaffAccounts } from "./seed/identity";
import { seedRestaurants, seedMenus } from "./seed/restaurants";
import { seedVenue } from "./seed/venue";
import { seedEvents } from "./seed/events";
import { seedPromoCodes } from "./seed/promo-codes";
import { seedOrders } from "./seed/orders";
import { seedFoodOrders } from "./seed/food-orders";
import { seedRatings } from "./seed/ratings";
import { seedNotifications } from "./seed/notifications";
import { SEED_PASSWORD, SUPER_ADMIN } from "./seed/data";

async function main() {
  const env = loadEnv();
  assertSafeToResetOrSeed(env);

  console.log(`Seeding against localhost:${env.apiGatewayPort} (NODE_ENV=${env.nodeEnv})…`);

  console.log("\n[1/9] identity: super admin");
  const { accessToken } = await ensureSuperAdmin(env);
  const adminApi = makeApi(env, accessToken);

  console.log("\n[2/9] restaurant-service: restaurants");
  const restaurantIds = await seedRestaurants(env, adminApi);

  console.log("\n[3/9] identity-service: restaurant owners, staff, customers");
  const { owners } = await seedRestaurantStaffAccounts(env, adminApi);
  const customers = await seedCustomers(env);

  console.log("\n[3b/9] restaurant-service: cover photos + menus");
  await seedMenus(env, restaurantIds, owners);

  console.log("\n[4/9] venue-service: seat maps, tables, seats, one pre-booked table each");
  const venues = await seedVenue(env, restaurantIds, owners);

  console.log("\n[5/9] event-service: events + ticket tiers");
  const events = await seedEvents(env, restaurantIds, owners, venues);

  console.log("\n[6/9] order-service: promo codes");
  await seedPromoCodes(env, events, owners);

  console.log("\n[7/9] order-service + checkin-service: ticket purchases");
  const orders = await seedOrders(env, events, venues, customers, owners);

  console.log("\n[8/9] food-order-service: pre-orders in a mix of statuses");
  await seedFoodOrders(env, restaurantIds, orders, owners);

  console.log("\n[8b/9] ratings-service: event + menu-item ratings");
  await seedRatings(orders);

  console.log("\n[9/9] notification-service: top up per-customer notifications");
  await seedNotifications(env, customers);

  console.log("\nDone. Seeded:");
  console.log(`  ${restaurantIds.length} restaurants, ${events.length} events, ${orders.length} orders`);
  console.log(`  Log in at web-admin as: ${SUPER_ADMIN.email} / ${SUPER_ADMIN.password}`);
  console.log(`  Log in at web-restaurant as any seeded owner/staff email, password: ${SEED_PASSWORD}`);
  console.log(`  Log in at web-user as any seeded customer email, password: ${SEED_PASSWORD}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});

import type { CeylonEnv } from "../lib/env";
import { queryMany, sqlLiteral } from "../lib/db";
import type { SeededCustomer } from "./identity";

/**
 * order-service and food-order-service already fire real notifications as
 * a side effect of confirming payment / marking food READY, so most
 * seeded customers already have at least one by this point. This is a
 * top-up pass, using the same internal endpoint those services call, so
 * every customer ends up with a couple — never a duplicate of the same
 * (userId, type) pair, so it's safe to run again after those other steps
 * already generated some.
 */
export async function seedNotifications(env: CeylonEnv, customers: SeededCustomer[]): Promise<void> {
  for (const customer of customers) {
    const existingTypes = await queryMany(
      "notification_db",
      `SELECT DISTINCT type FROM notifications WHERE user_id = ${sqlLiteral(customer.id)}`,
      ["type"],
    );
    const have = new Set(existingTypes.map((r) => r.type));

    if (!have.has("ORDER_CONFIRMED")) {
      await sendInternal(env, {
        userId: customer.id,
        type: "ORDER_CONFIRMED",
        title: "Your order is confirmed",
        body: "Your payment went through and your order is confirmed. See you there!",
      });
    }
    if (!have.has("FOOD_ORDER_READY")) {
      await sendInternal(env, {
        userId: customer.id,
        type: "FOOD_ORDER_READY",
        title: "Your food is ready",
        body: "Your food pre-order is ready at your table.",
      });
    }
  }
  console.log(`  notifications: topped up for ${customers.length} customer(s)`);
}

// Bypasses the gateway — see orders.ts's confirmOrderInternal for why.
async function sendInternal(
  env: CeylonEnv,
  body: { userId: string; type: string; title: string; body: string },
): Promise<void> {
  const res = await fetch(`http://localhost:${env.notificationServicePort}/internal/notifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": env.internalServiceSecret },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`internal notification create failed: ${res.status} ${await res.text()}`);
  }
}

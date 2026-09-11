import type { CeylonEnv } from "../lib/env";
import { queryMany, queryOne, sqlLiteral } from "../lib/db";
import type { SeededOrder } from "./orders";
import type { SeededOwner } from "./identity";

const STATUS_CYCLE = ["RECEIVED", "PREPARING", "READY", "SERVED"] as const;

/** Seeds a customer food pre-order (via the real guest endpoint) for every
 * paid seated order, then has restaurant staff move it through a mix of
 * kitchen statuses — round-robin, so the dashboard shows all four states
 * rather than every order looking identical. */
export async function seedFoodOrders(
  env: CeylonEnv,
  restaurantIds: string[],
  paidOrders: SeededOrder[],
  owners: SeededOwner[],
): Promise<void> {
  // "Opening Night" is deliberately past-dated (see events.ts) so
  // ratings-service has something eligible to rate — but that also means
  // it's long past food-order-service's own edit cutoff (2 hours before
  // the event starts), so a pre-order can never be submitted for it. Its
  // rating stays EVENT-only; ratings.ts already handles "no food
  // pre-order exists for this order" gracefully.
  const seatedPaidOrders = paidOrders.filter(
    (o) => o.tableNumber && o.targetState !== "PENDING" && o.eventTitle !== "Opening Night",
  );

  for (let i = 0; i < seatedPaidOrders.length; i++) {
    const order = seatedPaidOrders[i];
    const restaurantId = restaurantIds[order.restaurantIndex];
    const menuItems = await queryMany(
      "restaurant_db",
      `SELECT id FROM menu_items WHERE restaurant_id = ${sqlLiteral(restaurantId)} ORDER BY created_at LIMIT 2`,
      ["id"],
    );
    if (menuItems.length === 0) continue;

    const existing = await queryOne(
      "food_order_db",
      `SELECT id FROM food_pre_orders WHERE order_item_id = ${sqlLiteral(order.orderItemId)}`,
      ["id"],
    );

    await order.buyerApi.patch(`/food-pre-orders/by-order-item/${order.orderItemId}`, {
      orderId: order.orderId,
      items: menuItems.map((row, idx) => ({
        menuItemId: row.id,
        quantity: idx === 0 ? 2 : 1,
      })),
    });
    if (!existing) {
      console.log(`  food-orders: pre-order submitted for "${order.eventTitle}" (table ${order.tableNumber})`);
    }

    const foodPreOrder = await queryOne(
      "food_order_db",
      `SELECT id, status FROM food_pre_orders WHERE order_item_id = ${sqlLiteral(order.orderItemId)}`,
      ["id", "status"],
    );
    const targetStatus = STATUS_CYCLE[i % STATUS_CYCLE.length];
    if (foodPreOrder && foodPreOrder.status !== targetStatus) {
      const owner = owners[order.restaurantIndex].api;
      await owner.patch(`/food-pre-orders/${foodPreOrder.id}/status`, { status: targetStatus });
      console.log(`  food-orders: set status ${targetStatus} for table ${order.tableNumber}`);
    }
  }
}

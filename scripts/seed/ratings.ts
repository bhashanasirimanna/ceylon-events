import { queryOne, sqlLiteral } from "../lib/db";
import type { SeededOrder } from "./orders";

/** Rates the past ("Opening Night") event and, if a food pre-order exists
 * for that order, one of its menu items too — the two RatingSubjectType
 * values this system supports. */
export async function seedRatings(orders: SeededOrder[]): Promise<void> {
  const pastOrder = orders.find((o) => o.eventTitle === "Opening Night");
  if (!pastOrder) return;

  await createRatingIfMissing(pastOrder.buyerApi, {
    orderId: pastOrder.orderId,
    eventId: pastOrder.eventId,
    subjectType: "EVENT",
    subjectId: pastOrder.eventId,
    stars: 5,
    comment: "Wonderful first night — the kottu roti alone is worth the trip back.",
  });

  const foodPreOrder = await queryOne(
    "food_order_db",
    `SELECT id FROM food_pre_orders WHERE order_item_id = ${sqlLiteral(pastOrder.orderItemId)}`,
    ["id"],
  );
  if (!foodPreOrder) return;

  const item = await queryOne(
    "food_order_db",
    `SELECT menu_item_id FROM food_pre_order_items WHERE food_pre_order_id = ${sqlLiteral(foodPreOrder.id)} LIMIT 1`,
    ["menu_item_id"],
  );
  if (!item) return;

  await createRatingIfMissing(pastOrder.buyerApi, {
    orderId: pastOrder.orderId,
    eventId: pastOrder.eventId,
    subjectType: "MENU_ITEM",
    subjectId: item.menu_item_id,
    stars: 4,
    comment: "Generous portion, will order again.",
  });
}

async function createRatingIfMissing(
  buyerApi: { post: (path: string, body?: unknown) => Promise<any> },
  dto: {
    orderId: string;
    eventId: string;
    subjectType: "EVENT" | "MENU_ITEM";
    subjectId: string;
    stars: number;
    comment: string;
  },
): Promise<void> {
  const existing = await queryOne(
    "rating_db",
    `SELECT 1 as found FROM ratings WHERE order_id = ${sqlLiteral(dto.orderId)} AND subject_type = ${sqlLiteral(dto.subjectType)} AND subject_id = ${sqlLiteral(dto.subjectId)}`,
    ["found"],
  );
  if (existing) return;

  await buyerApi.post("/ratings", dto);
  console.log(`  ratings: ${dto.subjectType} rating (${dto.stars}★) seeded`);
}

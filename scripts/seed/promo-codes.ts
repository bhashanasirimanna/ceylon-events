import type { CeylonEnv } from "../lib/env";
import { queryOne, sqlLiteral } from "../lib/db";
import type { SeededEvent } from "./events";
import type { SeededOwner } from "./identity";

interface PromoPlan {
  eventTitle: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
}

const PROMO_PLANS: PromoPlan[] = [
  { eventTitle: "Spice Garden Live Night", code: "WELCOME10", discountType: "PERCENTAGE", discountValue: 10 },
  { eventTitle: "Ocean Terrace Live Night", code: "SAVE500", discountType: "FIXED", discountValue: 50000 },
];

export async function seedPromoCodes(
  env: CeylonEnv,
  events: SeededEvent[],
  owners: SeededOwner[],
): Promise<void> {
  for (const plan of PROMO_PLANS) {
    const event = events.find((e) => e.title === plan.eventTitle);
    if (!event) continue;
    const owner = owners[event.restaurantIndex].api;

    const existing = await queryOne(
      "order_db",
      `SELECT 1 as found FROM promo_codes WHERE event_id = ${sqlLiteral(event.id)} AND code = ${sqlLiteral(plan.code)}`,
      ["found"],
    );
    if (existing) continue;

    await owner.post("/promo-codes", {
      eventId: event.id,
      code: plan.code,
      discountType: plan.discountType,
      discountValue: plan.discountValue,
    });
    console.log(`  promo-codes: created ${plan.code} for "${event.title}"`);
  }
}

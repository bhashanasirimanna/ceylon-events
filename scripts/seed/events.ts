import type { CeylonEnv } from "../lib/env";
import { queryOne, sqlLiteral } from "../lib/db";
import type { Api } from "../lib/http";
import { uploadSeedImage } from "../lib/media";
import { RESTAURANTS } from "./data";
import type { SeededOwner } from "./identity";
import type { VenueResult } from "./venue";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TicketTierSeed {
  name: string;
  priceMinorUnits: number;
}

export interface EventPlanItem {
  title: string;
  description: string;
  startsAt: string;
  seated: boolean;
  tiers: TicketTierSeed[];
}

function eventPlanFor(restaurantName: string): EventPlanItem[] {
  const now = Date.now();
  return [
    {
      title: `${restaurantName} Live Night`,
      description: `An evening of live music and a curated tasting menu at ${restaurantName}.`,
      startsAt: new Date(now + 14 * DAY_MS).toISOString(),
      seated: true,
      tiers: [
        { name: "General", priceMinorUnits: 150000 },
        { name: "VIP", priceMinorUnits: 300000 },
      ],
    },
    {
      title: `${restaurantName} Long Table Dinner`,
      description: `A communal long-table dinner experience — walk-up entry, no assigned seating.`,
      startsAt: new Date(now + 30 * DAY_MS).toISOString(),
      seated: false,
      tiers: [{ name: "Entry", priceMinorUnits: 200000 }],
    },
  ];
}

// A single past event, seeded only for the first restaurant, purely so
// there's at least one PUBLISHED-and-already-happened event with a
// confirmed order to attach a rating to — ratings-service refuses to rate
// an event that hasn't started yet, and every other seeded event is
// deliberately future-dated per the task's own requirement.
const PAST_EVENT: EventPlanItem = {
  title: "Opening Night",
  description: "The night it all started — our very first ticketed evening.",
  startsAt: new Date(Date.now() - 14 * DAY_MS).toISOString(),
  seated: true,
  tiers: [{ name: "General", priceMinorUnits: 120000 }],
};

export interface SeededEvent {
  id: string;
  title: string;
  restaurantIndex: number;
  seated: boolean;
  isPast: boolean;
  tiers: Array<{ id: string; name: string; priceMinorUnits: number }>;
}

export async function seedEvents(
  env: CeylonEnv,
  restaurantIds: string[],
  owners: SeededOwner[],
  venues: VenueResult[],
): Promise<SeededEvent[]> {
  const events: SeededEvent[] = [];

  for (let i = 0; i < RESTAURANTS.length; i++) {
    const restaurantId = restaurantIds[i];
    const owner = owners[i].api;
    const plans = i === 0 ? [...eventPlanFor(RESTAURANTS[i].name), PAST_EVENT] : eventPlanFor(RESTAURANTS[i].name);

    for (const plan of plans) {
      events.push(
        await seedOneEvent(env, owner, restaurantId, i, plan, venues[i], plan === PAST_EVENT),
      );
    }
  }

  return events;
}

async function seedOneEvent(
  env: CeylonEnv,
  owner: Api,
  restaurantId: string,
  restaurantIndex: number,
  plan: EventPlanItem,
  venue: VenueResult,
  isPast: boolean,
): Promise<SeededEvent> {
  let eventId = (
    await queryOne(
      "event_db",
      `SELECT id FROM events WHERE restaurant_id = ${sqlLiteral(restaurantId)} AND title = ${sqlLiteral(plan.title)}`,
      ["id"],
    )
  )?.id;

  if (!eventId) {
    const bannerUrl = await uploadSeedImage(owner, "event-banner", plan.title);
    const created = await owner.post("/events", {
      restaurantId,
      seatMapVersionId: plan.seated ? venue.seatMapVersionId : undefined,
      title: plan.title,
      description: plan.description,
      bannerImageUrl: bannerUrl,
      startsAt: plan.startsAt,
    });
    eventId = created.id;
    await owner.patch(`/events/${eventId}/status`, { status: "PUBLISHED" });
    console.log(`  events: created "${plan.title}"`);
  }

  const tiers: SeededEvent["tiers"] = [];
  for (const tier of plan.tiers) {
    let tierId = (
      await queryOne(
        "event_db",
        `SELECT id FROM ticket_tiers WHERE event_id = ${sqlLiteral(eventId!)} AND name = ${sqlLiteral(tier.name)}`,
        ["id"],
      )
    )?.id;
    if (!tierId) {
      const created = await owner.post(`/events/${eventId}/ticket-tiers`, {
        name: tier.name,
        priceMinorUnits: tier.priceMinorUnits,
        currency: "LKR",
      });
      tierId = created.id;
    }
    tiers.push({ id: tierId!, name: tier.name, priceMinorUnits: tier.priceMinorUnits });
  }

  return {
    id: eventId!,
    title: plan.title,
    restaurantIndex,
    seated: plan.seated,
    isPast,
    tiers,
  };
}

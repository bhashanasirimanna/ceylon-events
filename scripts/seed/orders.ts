import type { CeylonEnv } from "../lib/env";
import { queryOne, sqlLiteral } from "../lib/db";
import type { Api } from "../lib/http";
import type { SeededEvent } from "./events";
import type { SeededCustomer } from "./identity";
import type { SeededOwner } from "./identity";
import type { VenueResult } from "./venue";

export type OrderTargetState = "PENDING" | "CONFIRMED" | "CHECKED_IN";

interface OrderScenario {
  customerIndex: number;
  eventTitle: string;
  tierName: string;
  // undefined => general-admission (no seat)
  seatLabel?: string;
  targetState: OrderTargetState;
}

const SCENARIOS: OrderScenario[] = [
  { customerIndex: 0, eventTitle: "Spice Garden Live Night", tierName: "General", seatLabel: "T2-1", targetState: "CHECKED_IN" },
  { customerIndex: 1, eventTitle: "Spice Garden Live Night", tierName: "VIP", seatLabel: "T4-1", targetState: "CONFIRMED" },
  { customerIndex: 2, eventTitle: "Spice Garden Long Table Dinner", tierName: "Entry", targetState: "PENDING" },
  { customerIndex: 3, eventTitle: "Ocean Terrace Live Night", tierName: "General", seatLabel: "T2-1", targetState: "CONFIRMED" },
  { customerIndex: 4, eventTitle: "Ocean Terrace Live Night", tierName: "VIP", seatLabel: "T4-1", targetState: "CHECKED_IN" },
  { customerIndex: 5, eventTitle: "Ocean Terrace Long Table Dinner", tierName: "Entry", targetState: "PENDING" },
  { customerIndex: 6, eventTitle: "Hill Country Kitchen Live Night", tierName: "General", seatLabel: "T2-1", targetState: "CONFIRMED" },
  { customerIndex: 7, eventTitle: "Hill Country Kitchen Live Night", tierName: "VIP", seatLabel: "T3-1", targetState: "PENDING" },
  // Past event — gives ratings-service something eligible to rate.
  { customerIndex: 0, eventTitle: "Opening Night", tierName: "General", seatLabel: "T2-2", targetState: "CHECKED_IN" },
];

export interface SeededOrder {
  orderId: string;
  orderItemId: string;
  buyerId: string;
  buyerApi: Api;
  eventId: string;
  eventTitle: string;
  restaurantIndex: number;
  tableNumber: string | null;
  targetState: OrderTargetState;
}

export async function seedOrders(
  env: CeylonEnv,
  events: SeededEvent[],
  venues: VenueResult[],
  customers: SeededCustomer[],
  owners: SeededOwner[],
): Promise<SeededOrder[]> {
  const results: SeededOrder[] = [];

  for (const scenario of SCENARIOS) {
    const event = events.find((e) => e.title === scenario.eventTitle);
    if (!event) throw new Error(`Seed order references unknown event "${scenario.eventTitle}"`);
    const tier = event.tiers.find((t) => t.name === scenario.tierName);
    if (!tier) throw new Error(`Event "${scenario.eventTitle}" has no tier "${scenario.tierName}"`);
    const customer = customers[scenario.customerIndex];
    const owner = owners[event.restaurantIndex].api;
    const venue = venues[event.restaurantIndex];

    const existing = await queryOne(
      "order_db",
      `SELECT oi.id as item_id, oi.order_id as order_id, oi.seat_id as seat_id, o.status as status
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.buyer_id = ${sqlLiteral(customer.id)} AND oi.ticket_tier_id = ${sqlLiteral(tier.id)}`,
      ["item_id", "order_id", "seat_id", "status"],
    );

    let orderId: string;
    let orderItemId: string;
    let seatId: string | null;
    let currentStatus: string;

    if (existing) {
      orderId = existing.order_id;
      orderItemId = existing.item_id;
      seatId = existing.seat_id || null;
      currentStatus = existing.status;
    } else {
      let holderToken: string | null = null;
      seatId = null;
      if (scenario.seatLabel) {
        const tableNumber = scenario.seatLabel.split("-")[0];
        const seatIds = venue.seatIdsByTable[tableNumber];
        const seatIndex = Number(scenario.seatLabel.split("-")[1]) - 1;
        seatId = seatIds[seatIndex];

        const hold = await customer.api.post(`/seat-map-versions/${venue.seatMapVersionId}/holds`, {
          seatId,
        });
        holderToken = hold.holderToken;
      }

      const order = await customer.api.post("/orders", {
        eventId: event.id,
        paymentMethod: "PAYMENT_PROOF",
        items: [seatId ? { ticketTierId: tier.id, seatId, holderToken } : { ticketTierId: tier.id }],
      });
      orderId = order.id;
      orderItemId = order.items[0].id;
      currentStatus = "PENDING";
      console.log(
        `  orders: ${customer.fullName} -> "${event.title}" / ${tier.name}${scenario.seatLabel ? ` (seat ${scenario.seatLabel})` : ""} [${scenario.targetState}]`,
      );
    }

    // Advance a possibly-pre-existing order the rest of the way to its
    // target state — covers both a brand-new order and one left
    // half-finished by an earlier, interrupted run (e.g. this step failed
    // last time after the order was created but before payment
    // confirmed): re-running always finishes the job rather than
    // silently leaving it stuck at whatever state it was found in.
    if (scenario.targetState !== "PENDING" && currentStatus === "PENDING") {
      await confirmOrderInternal(env, orderId);
      if (seatId) {
        await markSoldInternal(env, venue.seatMapVersionId, seatId, orderId);
      }
      currentStatus = "CONFIRMED";
      console.log(`  orders: confirmed payment for ${customer.fullName}'s order on "${event.title}"`);
    }

    if (scenario.targetState === "CHECKED_IN") {
      const alreadyCheckedIn = await queryOne(
        "checkin_db",
        `SELECT 1 as found FROM tickets WHERE order_item_id = ${sqlLiteral(orderItemId)} AND status = 'CHECKED_IN'`,
        ["found"],
      );
      if (!alreadyCheckedIn) {
        // The real lazy-generation call — this is what actually creates
        // the Ticket row in checkin_db. It only ever returns a rendered
        // QR *image* (qrCodeDataUrl), never the raw token in plain text
        // — real door-scan hardware decodes that image to get the token,
        // which is unnecessary complexity for a seed script, so the raw
        // qrToken is read directly from checkin_db (a read-only lookup,
        // same as this script's other idempotency checks) right after
        // triggering the real endpoint that created it. The check-in
        // itself still goes through the real
        // `/tickets/:qrToken/check-in` endpoint.
        await customer.api.get(`/tickets/for-order/${orderId}`);
        const ticketRow = await queryOne(
          "checkin_db",
          `SELECT qr_token FROM tickets WHERE order_item_id = ${sqlLiteral(orderItemId)}`,
          ["qr_token"],
        );
        if (!ticketRow) {
          throw new Error(`Ticket for order item ${orderItemId} was not lazily generated as expected`);
        }
        await owner.post(`/tickets/${ticketRow.qr_token}/check-in`);
        console.log(`  orders: checked in ${customer.fullName} for "${event.title}"`);
      }
    }

    results.push({
      orderId,
      orderItemId,
      buyerId: customer.id,
      buyerApi: customer.api,
      eventId: event.id,
      eventTitle: event.title,
      restaurantIndex: event.restaurantIndex,
      tableNumber: scenario.seatLabel ? scenario.seatLabel.split("-")[0] : null,
      targetState: scenario.targetState,
    });
  }

  return results;
}

// The api-gateway has no route for /internal/* (see proxy.service.ts's
// ROUTES table — "internal" isn't a registered first path segment), so
// this goes straight to order-service's own host-mapped port instead,
// exactly like payment-service itself does from inside the docker
// network.
async function confirmOrderInternal(env: CeylonEnv, orderId: string): Promise<void> {
  const res = await fetch(`http://localhost:${env.orderServicePort}/internal/orders/${orderId}/confirm-payment`, {
    method: "PATCH",
    headers: { "x-internal-secret": env.internalServiceSecret },
  });
  if (!res.ok) {
    throw new Error(`confirm-payment failed for order ${orderId}: ${res.status} ${await res.text()}`);
  }
}

async function markSoldInternal(
  env: CeylonEnv,
  seatMapVersionId: string,
  seatId: string,
  orderId: string,
): Promise<void> {
  const res = await fetch(
    `http://localhost:${env.apiGatewayPort}/api/seat-map-versions/${seatMapVersionId}/seats/${seatId}/mark-sold`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": env.internalServiceSecret },
      body: JSON.stringify({ orderId }),
    },
  );
  if (!res.ok) {
    throw new Error(`mark-sold failed for seat ${seatId}: ${res.status} ${await res.text()}`);
  }
}

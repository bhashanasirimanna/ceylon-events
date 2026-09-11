import type { CeylonEnv } from "../lib/env";
import { queryMany, queryOne, sqlLiteral } from "../lib/db";
import type { Api } from "../lib/http";
import { RESTAURANTS } from "./data";
import type { SeededOwner } from "./identity";

const SEAT_MAP_NAME = "Main Floor";

// tableNumber, shape, capacity — a realistic mix of small 2-tops through
// an 8-top, both shapes represented.
const TABLE_PLAN: Array<{ tableNumber: string; shape: "RECT" | "CIRCLE"; capacity: number }> = [
  { tableNumber: "T1", shape: "CIRCLE", capacity: 2 },
  { tableNumber: "T2", shape: "RECT", capacity: 4 },
  { tableNumber: "T3", shape: "RECT", capacity: 4 },
  { tableNumber: "T4", shape: "CIRCLE", capacity: 6 },
  { tableNumber: "T5", shape: "RECT", capacity: 8 },
];

export interface VenueResult {
  seatMapVersionId: string;
  tableIdByNumber: Record<string, string>;
  seatIdsByTable: Record<string, string[]>;
}

export async function seedVenue(
  env: CeylonEnv,
  restaurantIds: string[],
  owners: SeededOwner[],
): Promise<VenueResult[]> {
  const results: VenueResult[] = [];

  for (let i = 0; i < RESTAURANTS.length; i++) {
    const restaurantId = restaurantIds[i];
    const owner = owners[i].api;

    let seatMapId = (
      await queryOne(
        "venue_db",
        `SELECT id FROM seat_maps WHERE restaurant_id = ${sqlLiteral(restaurantId)} AND name = ${sqlLiteral(SEAT_MAP_NAME)}`,
        ["id"],
      )
    )?.id;
    if (!seatMapId) {
      const created = await owner.post("/seat-maps", {
        restaurantId,
        name: SEAT_MAP_NAME,
        canvasWidth: 1200,
        canvasHeight: 800,
      });
      seatMapId = created.id;
      console.log(`  venue: created seat map "${SEAT_MAP_NAME}" for restaurant ${i + 1}`);
    }

    let sectionId = (
      await queryOne(
        "venue_db",
        `SELECT id FROM seat_sections WHERE seat_map_id = ${sqlLiteral(seatMapId!)} AND name = ${sqlLiteral("Main Hall")}`,
        ["id"],
      )
    )?.id;
    if (!sectionId) {
      const created = await owner.post(`/seat-maps/${seatMapId}/sections`, {
        name: "Main Hall",
        x: 40,
        y: 40,
        width: 900,
        height: 600,
      });
      sectionId = created.id;
    }

    const tableIdByNumber: Record<string, string> = {};
    const seatIdsByTable: Record<string, string[]> = {};

    for (let t = 0; t < TABLE_PLAN.length; t++) {
      const plan = TABLE_PLAN[t];
      const col = t % 3;
      const row = Math.floor(t / 3);
      const x = 150 + col * 280;
      const y = 150 + row * 280;

      let tableId = (
        await queryOne(
          "venue_db",
          `SELECT id FROM seat_tables WHERE seat_map_id = ${sqlLiteral(seatMapId!)} AND table_number = ${sqlLiteral(plan.tableNumber)}`,
          ["id"],
        )
      )?.id;
      if (!tableId) {
        const created = await owner.post(`/seat-maps/${seatMapId}/tables`, {
          sectionId,
          tableNumber: plan.tableNumber,
          x,
          y,
          shape: plan.shape,
          capacity: plan.capacity,
        });
        tableId = created.id;
        console.log(`  venue: created table ${plan.tableNumber} (restaurant ${i + 1})`);
      }
      tableIdByNumber[plan.tableNumber] = tableId!;

      const existingSeats = await queryMany(
        "venue_db",
        `SELECT id FROM seats WHERE table_id = ${sqlLiteral(tableId!)} ORDER BY seat_label`,
        ["id"],
      );
      if (existingSeats.length === 0) {
        const radius = plan.shape === "CIRCLE" ? 55 : 60;
        const seats = Array.from({ length: plan.capacity }).map((_, seatIndex) => {
          const angle = (2 * Math.PI * seatIndex) / plan.capacity;
          return {
            seatLabel: `${plan.tableNumber}-${seatIndex + 1}`,
            x: Math.round(x + radius * Math.cos(angle)),
            y: Math.round(y + radius * Math.sin(angle)),
          };
        });
        await owner.post(`/tables/${tableId}/seats`, { seats });
        const refetched = await queryMany(
          "venue_db",
          `SELECT id FROM seats WHERE table_id = ${sqlLiteral(tableId!)} ORDER BY seat_label`,
          ["id"],
        );
        seatIdsByTable[plan.tableNumber] = refetched.map((r) => r.id);
      } else {
        seatIdsByTable[plan.tableNumber] = existingSeats.map((r) => r.id);
      }
    }

    let seatMapVersionId = (
      await queryOne(
        "venue_db",
        `SELECT id FROM seat_map_versions WHERE seat_map_id = ${sqlLiteral(seatMapId!)} ORDER BY version_number DESC LIMIT 1`,
        ["id"],
      )
    )?.id;
    if (!seatMapVersionId) {
      const published = await owner.post(`/seat-maps/${seatMapId}/publish`);
      seatMapVersionId = published.id;
      console.log(`  venue: published seat map version for restaurant ${i + 1}`);
    }

    // Pre-mark the first table's seats as SOLD so the UI has at least one
    // "already booked" table to show, per the task's requirement — done
    // via the internal mark-sold endpoint directly (the same one
    // payment-service calls once a real payment confirms) rather than
    // running a fake buyer through the whole checkout flow just to get a
    // seat into the SOLD state.
    const firstTableSeats = seatIdsByTable[TABLE_PLAN[0].tableNumber];
    for (const seatId of firstTableSeats) {
      const already = await queryOne(
        "venue_db",
        `SELECT 1 as found FROM sold_seats WHERE seat_map_version_id = ${sqlLiteral(seatMapVersionId!)} AND seat_id = ${sqlLiteral(seatId)}`,
        ["found"],
      );
      if (!already) {
        await markSoldInternal(env, seatMapVersionId!, seatId);
      }
    }

    results.push({ seatMapVersionId: seatMapVersionId!, tableIdByNumber, seatIdsByTable });
  }

  return results;
}

async function markSoldInternal(env: CeylonEnv, seatMapVersionId: string, seatId: string): Promise<void> {
  const res = await fetch(
    `http://localhost:${env.apiGatewayPort}/api/seat-map-versions/${seatMapVersionId}/seats/${seatId}/mark-sold`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": env.internalServiceSecret },
      body: JSON.stringify({ orderId: "00000000-0000-4000-8000-000000000000" }),
    },
  );
  if (!res.ok) {
    throw new Error(`mark-sold failed for seat ${seatId}: ${res.status} ${await res.text()}`);
  }
}

import { z } from "zod";

export enum TableShape {
  RECT = "RECT",
  CIRCLE = "CIRCLE",
}

export enum SeatMapStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
}

export enum SeatStatus {
  AVAILABLE = "AVAILABLE",
  HELD = "HELD",
  HELD_BY_ME = "HELD_BY_ME",
  SOLD = "SOLD",
}

export const createSeatMapSchema = z.object({
  name: z.string().min(1),
  canvasWidth: z.number().int().min(100).default(1200),
  canvasHeight: z.number().int().min(100).default(800),
});
export type CreateSeatMapDto = z.infer<typeof createSeatMapSchema>;

export const createSectionSchema = z.object({
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  color: z.string().optional(),
  sortOrder: z.number().int().default(0),
});
export type CreateSectionDto = z.infer<typeof createSectionSchema>;

export const createTableSchema = z.object({
  sectionId: z.string().uuid().nullable().optional(),
  tableNumber: z.string().min(1),
  x: z.number(),
  y: z.number(),
  shape: z.nativeEnum(TableShape).default(TableShape.RECT),
  capacity: z.number().int().min(1),
});
export type CreateTableDto = z.infer<typeof createTableSchema>;

export const createSeatSchema = z.object({
  seatLabel: z.string().min(1),
  x: z.number(),
  y: z.number(),
});
export type CreateSeatDto = z.infer<typeof createSeatSchema>;

export const bulkCreateSeatsSchema = z.object({
  seats: z.array(createSeatSchema).min(1),
});
export type BulkCreateSeatsDto = z.infer<typeof bulkCreateSeatsSchema>;

export interface SeatSnapshot {
  id: string;
  tableId: string;
  seatLabel: string;
  x: number;
  y: number;
}

export interface TableSnapshot {
  id: string;
  sectionId: string | null;
  tableNumber: string;
  x: number;
  y: number;
  shape: TableShape;
  capacity: number;
  seats: SeatSnapshot[];
}

export interface SectionSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
  sortOrder: number;
}

export interface SeatMapSnapshot {
  seatMapId: string;
  restaurantId: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  sections: SectionSnapshot[];
  tables: TableSnapshot[];
}

// Derived, read-only view over the existing per-seat SeatStatus data —
// deliberately not a stored field anywhere. A table is "BOOKED" once any
// one of its seats is sold; "HELD" if none are sold yet but at least one
// is mid-checkout; otherwise "AVAILABLE". This is the only table-level
// booking state the system needs (e.g. for staff deciding whether a
// waiter order may be placed against it) — it is NOT a food-order concept
// and must never be confused with FoodOrderStatus.
export type TableBookingStatus = "AVAILABLE" | "HELD" | "BOOKED";

// Structurally minimal on purpose — callers pass either the full
// SeatMapSnapshot or a service's own slimmer local mirror of it (e.g.
// food-order-service's UpstreamSeatMapSnapshot), which only ever carries
// table/seat ids, never the builder-only fields (position, shape, etc.).
export interface TableAvailabilityInput {
  tables: Array<{ id: string; seats: Array<{ id: string }> }>;
}

export function aggregateTableStatuses(
  snapshot: TableAvailabilityInput,
  availability: Record<string, SeatStatus>,
): Record<string, TableBookingStatus> {
  const result: Record<string, TableBookingStatus> = {};
  for (const table of snapshot.tables) {
    let status: TableBookingStatus = "AVAILABLE";
    for (const seat of table.seats) {
      const seatStatus = availability[seat.id];
      if (seatStatus === SeatStatus.SOLD) {
        status = "BOOKED";
        break;
      }
      if (seatStatus === SeatStatus.HELD || seatStatus === SeatStatus.HELD_BY_ME) {
        status = "HELD";
      }
    }
    result[table.id] = status;
  }
  return result;
}

export const createHoldSchema = z.object({
  seatId: z.string().uuid(),
});
export type CreateHoldDto = z.infer<typeof createHoldSchema>;

export const releaseHoldSchema = z.object({
  holderToken: z.string().min(1),
});
export type ReleaseHoldDto = z.infer<typeof releaseHoldSchema>;

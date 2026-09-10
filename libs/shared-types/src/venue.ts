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

export const createHoldSchema = z.object({
  seatId: z.string().uuid(),
});
export type CreateHoldDto = z.infer<typeof createHoldSchema>;

export const releaseHoldSchema = z.object({
  holderToken: z.string().min(1),
});
export type ReleaseHoldDto = z.infer<typeof releaseHoldSchema>;

import type { SeatStatus, TableShape } from "@ceylon/shared-types";

// Normalized shape the canvas renders. Consumers map either the admin
// "draft" definition (GET /seat-maps/:id) or a published version's
// snapshot (GET /seat-map-versions/:id) into this shape — the canvas
// itself doesn't care which one it's looking at.
export interface CanvasSeat {
  id: string;
  tableId: string;
  seatLabel: string;
  x: number;
  y: number;
}

export interface CanvasTable {
  id: string;
  sectionId: string | null;
  tableNumber: string;
  x: number;
  y: number;
  shape: TableShape;
  capacity: number;
  seats: CanvasSeat[];
}

export interface CanvasSection {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
}

export interface CanvasData {
  canvasWidth: number;
  canvasHeight: number;
  sections: CanvasSection[];
  tables: CanvasTable[];
}

export type SeatStatusMap = Record<string, SeatStatus>;

import type { SeatMapStatus, TableShape } from "@ceylon/shared-types";

export interface SeatMap {
  id: string;
  restaurantId: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  status: SeatMapStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SeatSection {
  id: string;
  seatMapId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
  sortOrder: number;
}

export interface Seat {
  id: string;
  seatMapId: string;
  tableId: string;
  seatLabel: string;
  x: number;
  y: number;
}

export interface SeatTable {
  id: string;
  seatMapId: string;
  sectionId: string | null;
  tableNumber: string;
  x: number;
  y: number;
  shape: TableShape;
  capacity: number;
  seats: Seat[];
}

export interface SeatMapDefinition {
  seatMap: SeatMap;
  sections: SeatSection[];
  tables: SeatTable[];
}

export interface SeatMapVersion {
  id: string;
  seatMapId: string;
  versionNumber: number;
  publishedAt: string;
}

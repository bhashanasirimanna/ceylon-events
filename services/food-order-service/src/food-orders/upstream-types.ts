import type { OrderStatus } from "@ceylon/shared-types";

export interface UpstreamOrderItem {
  id: string;
  orderId: string;
  ticketTierId: string;
  seatId: string | null;
  seatLabel: string | null;
  priceMinorUnits: number;
}

export interface UpstreamOrder {
  id: string;
  buyerId: string;
  eventId: string;
  status: OrderStatus;
  items: UpstreamOrderItem[];
}

export interface UpstreamEvent {
  id: string;
  restaurantId: string;
  seatMapVersionId: string | null;
  title: string;
  startsAt: string;
}

export interface UpstreamMenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  priceMinorUnits: number;
  isAvailable: boolean;
}

export interface UpstreamMenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  items: UpstreamMenuItem[];
}

export interface UpstreamSeatMapSnapshot {
  tables: Array<{
    id: string;
    tableNumber: string;
    seats: Array<{ id: string; seatLabel: string }>;
  }>;
}

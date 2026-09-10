import type { OrderStatus } from "@ceylon/shared-types";

export interface UpstreamOrderItem {
  id: string;
  orderId: string;
  ticketTierId: string;
  seatId: string | null;
  seatLabel: string | null;
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
  title: string;
}

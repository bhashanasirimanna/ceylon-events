import type { OrderStatus, PaymentMethod } from "@ceylon/shared-types";

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
  totalMinorUnits: number;
  currency: string;
  paymentMethod: PaymentMethod;
  items: UpstreamOrderItem[];
}

export interface UpstreamEvent {
  id: string;
  restaurantId: string;
  seatMapVersionId: string | null;
  title: string;
}

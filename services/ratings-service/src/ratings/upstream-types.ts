export interface UpstreamOrderItem {
  id: string;
  ticketTierId: string;
  seatId: string | null;
}

export interface UpstreamOrder {
  id: string;
  buyerId: string;
  eventId: string;
  status: string;
  items: UpstreamOrderItem[];
}

export interface UpstreamEvent {
  id: string;
  restaurantId: string;
  startsAt: string;
  status: string;
}

export interface UpstreamFoodPreOrderItem {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
}

export interface UpstreamFoodPreOrder {
  id: string;
  orderItemId: string;
  items: UpstreamFoodPreOrderItem[];
}

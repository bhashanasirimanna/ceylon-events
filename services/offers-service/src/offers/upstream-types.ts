export interface UpstreamEvent {
  id: string;
  restaurantId: string;
  title: string;
}

export interface UpstreamOrderItem {
  id: string;
  orderId: string;
  ticketTierId: string;
}

export interface UpstreamOrder {
  id: string;
  buyerId: string;
  eventId: string;
  items: UpstreamOrderItem[];
}

export interface UpstreamTicketLookup {
  id: string;
  orderItemId: string;
  eventTitle: string;
  ticketTierId: string;
  seatLabel: string | null;
  status: string;
  checkedInAt: string | null;
}

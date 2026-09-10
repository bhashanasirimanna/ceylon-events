export interface UpstreamEvent {
  id: string;
  restaurantId: string;
  title: string;
  startsAt: string;
  status: string;
}

export interface UpstreamTicketTier {
  id: string;
  eventId: string;
  name: string;
}

export interface UpstreamOrderItemForReport {
  id: string;
  ticketTierId: string;
  priceMinorUnits: number;
}

export interface UpstreamOrderForReport {
  id: string;
  status: string;
  totalMinorUnits: number;
  currency: string;
  items: UpstreamOrderItemForReport[];
}

export interface UpstreamMenuItemAggregate {
  menuItemId: string;
  menuItemName: string;
  totalQuantity: number;
}

export interface UpstreamRatingSummary {
  average: number | null;
  count: number;
}

export interface UpstreamPaginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpstreamRestaurant {
  id: string;
  name: string;
}

export interface UpstreamPlatformOrderTotals {
  totalOrders: number;
  confirmedOrders: number;
  totalRevenueMinorUnits: number;
  currency: string;
}

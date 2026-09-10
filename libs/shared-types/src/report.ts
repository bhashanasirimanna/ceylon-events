export interface EventReportTierBreakdown {
  ticketTierId: string;
  ticketTierName: string;
  sold: number;
  revenueMinorUnits: number;
}

export interface EventReport {
  eventId: string;
  eventTitle: string;
  restaurantId: string;
  startsAt: string;
  ticketsSold: number;
  revenueMinorUnits: number;
  currency: string;
  tierBreakdown: EventReportTierBreakdown[];
  foodItemSummary: Array<{
    menuItemId: string;
    menuItemName: string;
    totalQuantity: number;
  }>;
  ratingSummary: { average: number | null; count: number };
}

export interface RestaurantReport {
  restaurantId: string;
  restaurantName: string;
  eventCount: number;
  ticketsSold: number;
  revenueMinorUnits: number;
  currency: string;
  ratingSummary: { average: number | null; count: number };
  events: Array<{
    eventId: string;
    eventTitle: string;
    startsAt: string;
    ticketsSold: number;
    revenueMinorUnits: number;
  }>;
}

export interface PlatformTotals {
  totalOrders: number;
  confirmedOrders: number;
  totalRevenueMinorUnits: number;
  currency: string;
  totalRestaurants: number;
  totalEvents: number;
}

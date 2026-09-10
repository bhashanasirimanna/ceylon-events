import type {
  UserRole,
  RestaurantStatus,
  EventStatus,
  PaymentStatus,
  DiscountType,
  RedemptionType,
  RatingSubjectType,
  NotificationType,
} from "@ceylon/shared-types";

export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  restaurantId: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  address: string;
  contactEmail: string;
  contactPhone: string | null;
  coverPhotoUrl: string | null;
  status: RestaurantStatus;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Event {
  id: string;
  restaurantId: string;
  seatMapVersionId: string | null;
  title: string;
  description: string | null;
  bannerImageUrl: string | null;
  startsAt: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TicketTier {
  id: string;
  eventId: string;
  name: string;
  priceMinorUnits: number;
  currency: string;
  saleStartAt: string | null;
  saleEndAt: string | null;
  allowedSectionIds: string[] | null;
  quantityLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  eventId: string;
  restaurantId: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  redemptionType: RedemptionType;
  redemptionCap: number | null;
  applicableMenuCategoryId: string | null;
  applicableMenuItemIds: string[] | null;
  ticketTierIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OfferRedemption {
  id: string;
  offerId: string;
  orderItemId: string;
  redeemedAt: string;
  redeemedByUserId: string;
  notes: string | null;
}

export interface PromoCode {
  id: string;
  eventId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  applicableTicketTierId: string | null;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProof {
  id: string;
  paymentId: string;
  orderId: string;
  objectKey: string;
  publicUrl: string;
  referenceNote: string;
  status: PaymentStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSnapshot {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationSnapshot[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

export interface RatingSnapshot {
  id: string;
  buyerId: string;
  orderId: string;
  eventId: string;
  restaurantId: string;
  subjectType: RatingSubjectType;
  subjectId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface EventReportTierBreakdown {
  ticketTierId: string;
  ticketTierName: string;
  sold: number;
  revenueMinorUnits: number;
}

export interface EventReportFoodItemSummary {
  menuItemId: string;
  menuItemName: string;
  totalQuantity: number;
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
  foodItemSummary: EventReportFoodItemSummary[];
  ratingSummary: RatingSummary;
}

export interface RestaurantReportEvent {
  eventId: string;
  eventTitle: string;
  startsAt: string;
  ticketsSold: number;
  revenueMinorUnits: number;
}

export interface RestaurantReport {
  restaurantId: string;
  restaurantName: string;
  eventCount: number;
  ticketsSold: number;
  revenueMinorUnits: number;
  currency: string;
  ratingSummary: RatingSummary;
  events: RestaurantReportEvent[];
}

export interface PlatformTotals {
  totalOrders: number;
  confirmedOrders: number;
  totalRevenueMinorUnits: number;
  currency: string;
  totalRestaurants: number;
  totalEvents: number;
}

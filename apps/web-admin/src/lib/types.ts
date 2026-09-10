import type {
  UserRole,
  RestaurantStatus,
  EventStatus,
  PaymentStatus,
  DiscountType,
  RedemptionType,
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

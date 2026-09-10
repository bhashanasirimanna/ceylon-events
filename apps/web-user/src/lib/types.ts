import type {
  DietaryTag,
  EventStatus,
  OrderStatus,
  PaymentMethod,
  RestaurantStatus,
} from "@ceylon/shared-types";

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

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMinorUnits: number;
  currency: string;
  dietaryTags: DietaryTag[];
  isAvailable: boolean;
  photoUrls: string[];
  avgRating: number | null;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  restaurantId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface EventListing {
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

export interface OrderItem {
  id: string;
  orderId: string;
  ticketTierId: string;
  seatId: string | null;
  seatLabel: string | null;
  priceMinorUnits: number;
  createdAt: string;
}

export interface Order {
  id: string;
  buyerId: string;
  eventId: string;
  status: OrderStatus;
  totalMinorUnits: number;
  currency: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

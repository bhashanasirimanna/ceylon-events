import type {
  DietaryTag,
  EventStatus,
  FoodOrderStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RestaurantStatus,
  TicketStatus,
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
  subtotalMinorUnits: number;
  discountMinorUnits: number;
  totalMinorUnits: number;
  promoCodeId: string | null;
  currency: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface Payment {
  id: string;
  orderId: string;
  buyerId: string;
  amountMinorUnits: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  payherePaymentId: string | null;
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

export interface PaymentForOrder {
  payment: Payment | null;
  proofs: PaymentProof[];
}

export interface PayHereCheckoutParams {
  action: string;
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  currency: string;
  amount: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  hash: string;
}

export interface PresignUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

export interface Ticket {
  id: string;
  orderItemId: string;
  eventId: string;
  ticketTierId: string;
  seatId: string | null;
  seatLabel: string | null;
  status: TicketStatus;
  checkedInAt: string | null;
  qrCodeDataUrl: string;
}

export interface FoodPreOrderItemSnapshot {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  notes: string | null;
  priceMinorUnits: number;
}

export interface FoodPreOrderSnapshot {
  id: string;
  orderId: string;
  orderItemId: string;
  eventId: string;
  restaurantId: string;
  buyerId: string;
  seatId: string | null;
  seatLabel: string | null;
  tableNumber: string | null;
  status: FoodOrderStatus;
  items: FoodPreOrderItemSnapshot[];
  createdAt: string;
  updatedAt: string;
}

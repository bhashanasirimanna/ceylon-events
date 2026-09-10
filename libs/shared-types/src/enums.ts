export enum RestaurantStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  SUSPENDED = "SUSPENDED",
}

export enum DietaryTag {
  VEG = "VEG",
  VEGAN = "VEGAN",
  GLUTEN_FREE = "GLUTEN_FREE",
  SPICY = "SPICY",
}

export enum EventStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
}

export enum PaymentMethod {
  PAYHERE = "PAYHERE",
  PAYMENT_PROOF = "PAYMENT_PROOF",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  REFUNDED = "REFUNDED",
}

export enum OrderStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export enum FoodOrderStatus {
  RECEIVED = "RECEIVED",
  PREPARING = "PREPARING",
  READY = "READY",
  SERVED = "SERVED",
}

export enum RedemptionType {
  UNLIMITED = "UNLIMITED",
  CAPPED = "CAPPED",
  SINGLE_USE = "SINGLE_USE",
}

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
  FREE_ITEM = "FREE_ITEM",
}

export enum RatingSubjectType {
  EVENT = "EVENT",
  MENU_ITEM = "MENU_ITEM",
}

export enum TicketStatus {
  ISSUED = "ISSUED",
  CHECKED_IN = "CHECKED_IN",
}

export enum NotificationType {
  ORDER_CONFIRMED = "ORDER_CONFIRMED",
  ORDER_CANCELLED = "ORDER_CANCELLED",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  FOOD_ORDER_READY = "FOOD_ORDER_READY",
}

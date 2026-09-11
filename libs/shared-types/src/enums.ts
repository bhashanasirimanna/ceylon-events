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

// Independent of FoodOrderStatus (kitchen progress) — this only says how
// the order originated. A customer's own pre-order vs. a waiter placing an
// order at the table for the same physical table are otherwise identical
// once they reach the kitchen.
export enum FoodOrderSource {
  PRE_ORDER = "PRE_ORDER",
  WAITER = "WAITER",
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

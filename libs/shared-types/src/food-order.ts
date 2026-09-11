import { z } from "zod";
import { FoodOrderSource, FoodOrderStatus } from "./enums";

export const foodPreOrderItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});
export type FoodPreOrderItemInput = z.infer<typeof foodPreOrderItemInputSchema>;

export const submitFoodPreOrderSchema = z.object({
  orderId: z.string().uuid(),
  items: z.array(foodPreOrderItemInputSchema).min(1),
});
export type SubmitFoodPreOrderDto = z.infer<typeof submitFoodPreOrderSchema>;

// Staff/waiter table-order creation. Deliberately has no restaurantId,
// tableLabel, prices, waiterUserId, or source — all of those are resolved
// server-side from the authenticated caller and the table/menu records
// themselves, never trusted from the client.
export const submitWaiterFoodOrderSchema = z.object({
  eventId: z.string().uuid(),
  tableId: z.string().uuid(),
  items: z.array(foodPreOrderItemInputSchema).min(1),
  notes: z.string().optional(),
  // Idempotency key: a waiter double-tapping "Place order" on poor Wi-Fi
  // resubmits the same key, which returns the original order instead of
  // creating a duplicate.
  clientRequestId: z.string().min(1).optional(),
});
export type SubmitWaiterFoodOrderDto = z.infer<
  typeof submitWaiterFoodOrderSchema
>;

export const updateFoodOrderStatusSchema = z.object({
  status: z.nativeEnum(FoodOrderStatus),
});
export type UpdateFoodOrderStatusDto = z.infer<
  typeof updateFoodOrderStatusSchema
>;

// Keyed by the food-pre-order's own id, not orderItemId — waiter-created
// orders have no order item to key off of, so this is the one identifier
// every food order (either source) always has.
export const bulkUpdateFoodOrderStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.nativeEnum(FoodOrderStatus),
});
export type BulkUpdateFoodOrderStatusDto = z.infer<
  typeof bulkUpdateFoodOrderStatusSchema
>;

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
  // Null for a WAITER-sourced order — there's no specific ticket/order item
  // it was pre-ordered against.
  orderId: string | null;
  orderItemId: string | null;
  eventId: string;
  restaurantId: string;
  // Null for a WAITER-sourced order — a table can be shared by multiple
  // buyers, so there's no single unambiguous buyer to attribute it to.
  buyerId: string | null;
  seatId: string | null;
  seatLabel: string | null;
  // Authoritative table identity (FK into venue-service's table). Null
  // only for general-admission tickets with no seat map at all.
  tableId: string | null;
  // Display snapshot of the table's label at the time this order was
  // created — never the grouping key, tableId is.
  tableNumber: string | null;
  status: FoodOrderStatus;
  source: FoodOrderSource;
  // Set only for WAITER-sourced orders — the authenticated staff member
  // who created it.
  createdByUserId: string | null;
  notes: string | null;
  items: FoodPreOrderItemSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemAggregate {
  menuItemId: string;
  menuItemName: string;
  totalQuantity: number;
}

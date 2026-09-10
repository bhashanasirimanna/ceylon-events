import { z } from "zod";
import { FoodOrderStatus } from "./enums";

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

export const updateFoodOrderStatusSchema = z.object({
  status: z.nativeEnum(FoodOrderStatus),
});
export type UpdateFoodOrderStatusDto = z.infer<
  typeof updateFoodOrderStatusSchema
>;

export const bulkUpdateFoodOrderStatusSchema = z.object({
  orderItemIds: z.array(z.string().uuid()).min(1),
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

export interface MenuItemAggregate {
  menuItemId: string;
  menuItemName: string;
  totalQuantity: number;
}

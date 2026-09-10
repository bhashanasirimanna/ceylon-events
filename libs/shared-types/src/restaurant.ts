import { z } from "zod";
import { DietaryTag, RestaurantStatus } from "./enums";

export const createRestaurantSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  address: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
});
export type CreateRestaurantDto = z.infer<typeof createRestaurantSchema>;

export const updateRestaurantStatusSchema = z.object({
  status: z.nativeEnum(RestaurantStatus),
});
export type UpdateRestaurantStatusDto = z.infer<
  typeof updateRestaurantStatusSchema
>;

export const createMenuCategorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateMenuCategoryDto = z.infer<typeof createMenuCategorySchema>;

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  priceMinorUnits: z.number().int().min(0),
  currency: z.string().length(3).default("LKR"),
  dietaryTags: z.array(z.nativeEnum(DietaryTag)).default([]),
  isAvailable: z.boolean().default(true),
});
export type CreateMenuItemDto = z.infer<typeof createMenuItemSchema>;

export const updateMenuItemSchema = createMenuItemSchema.partial();
export type UpdateMenuItemDto = z.infer<typeof updateMenuItemSchema>;

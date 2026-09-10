import { z } from "zod";
import { DiscountType } from "./enums";

export const createPromoCodeSchema = z.object({
  eventId: z.string().uuid(),
  code: z.string().min(1),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().int().min(0),
  applicableTicketTierId: z.string().uuid().nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});
export type CreatePromoCodeDto = z.infer<typeof createPromoCodeSchema>;

export const updatePromoCodeSchema = z.object({
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().int().min(0).optional(),
  applicableTicketTierId: z.string().uuid().nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePromoCodeDto = z.infer<typeof updatePromoCodeSchema>;

export interface PromoCodeSnapshot {
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

export interface PromoCodeValidationResult {
  valid: boolean;
  reason?: string;
  promoCode?: PromoCodeSnapshot;
}

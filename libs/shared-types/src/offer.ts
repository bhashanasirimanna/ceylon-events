import { z } from "zod";
import { DiscountType, RedemptionType } from "./enums";

export const createOfferSchema = z
  .object({
    eventId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional(),
    discountType: z.nativeEnum(DiscountType),
    discountValue: z.number().int().min(0),
    redemptionType: z.nativeEnum(RedemptionType),
    redemptionCap: z.number().int().min(1).nullable().optional(),
    applicableMenuCategoryId: z.string().uuid().nullable().optional(),
    applicableMenuItemIds: z.array(z.string().uuid()).nullable().optional(),
    ticketTierIds: z.array(z.string().uuid()).min(1),
  })
  .refine(
    (data) =>
      data.redemptionType !== RedemptionType.CAPPED || !!data.redemptionCap,
    { message: "redemptionCap is required when redemptionType is CAPPED" },
  );
export type CreateOfferDto = z.infer<typeof createOfferSchema>;

export const updateOfferSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().int().min(0).optional(),
  redemptionType: z.nativeEnum(RedemptionType).optional(),
  redemptionCap: z.number().int().min(1).nullable().optional(),
  applicableMenuCategoryId: z.string().uuid().nullable().optional(),
  applicableMenuItemIds: z.array(z.string().uuid()).nullable().optional(),
  ticketTierIds: z.array(z.string().uuid()).min(1).optional(),
});
export type UpdateOfferDto = z.infer<typeof updateOfferSchema>;

export const redeemOfferSchema = z.object({
  qrToken: z.string().min(1),
});
export type RedeemOfferDto = z.infer<typeof redeemOfferSchema>;

export interface OfferSnapshot {
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

export interface OfferWithRedemptionState extends OfferSnapshot {
  /** How many times THIS ticket has redeemed this offer so far. */
  redeemedCount: number;
  /** Null for UNLIMITED offers. */
  remaining: number | null;
}

export interface OfferRedemptionRecord {
  id: string;
  offerId: string;
  orderItemId: string;
  redeemedAt: string;
  redeemedByUserId: string;
  notes: string | null;
}

import { z } from "zod";
import { EventStatus } from "./enums";

export const createEventSchema = z.object({
  restaurantId: z.string().uuid(),
  seatMapVersionId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  bannerImageUrl: z.string().optional(),
  startsAt: z.string(), // ISO datetime
});
export type CreateEventDto = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.partial().omit({
  restaurantId: true,
});
export type UpdateEventDto = z.infer<typeof updateEventSchema>;

export const updateEventStatusSchema = z.object({
  status: z.nativeEnum(EventStatus),
});
export type UpdateEventStatusDto = z.infer<typeof updateEventStatusSchema>;

export const createTicketTierSchema = z.object({
  name: z.string().min(1),
  priceMinorUnits: z.number().int().min(0),
  currency: z.string().length(3).default("LKR"),
  saleStartAt: z.string().nullable().optional(),
  saleEndAt: z.string().nullable().optional(),
  allowedSectionIds: z.array(z.string().uuid()).nullable().optional(),
  quantityLimit: z.number().int().min(1).nullable().optional(),
});
export type CreateTicketTierDto = z.infer<typeof createTicketTierSchema>;

export const updateTicketTierSchema = createTicketTierSchema.partial();
export type UpdateTicketTierDto = z.infer<typeof updateTicketTierSchema>;

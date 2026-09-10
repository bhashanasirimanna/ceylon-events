import { z } from "zod";
import { PaymentMethod } from "./enums";

export const orderItemInputSchema = z.object({
  ticketTierId: z.string().uuid(),
  seatId: z.string().uuid().nullable().optional(),
  // Required when seatId is set — proves the buyer currently holds that
  // seat (see the Venue/Seating Service's Redis hold-lock mechanism).
  holderToken: z.string().nullable().optional(),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createOrderSchema = z.object({
  eventId: z.string().uuid(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  items: z.array(orderItemInputSchema).min(1),
  promoCode: z.string().optional(),
});
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

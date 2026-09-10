import { z } from "zod";
import { RatingSubjectType } from "./enums";

export const createRatingSchema = z.object({
  orderId: z.string().uuid(),
  eventId: z.string().uuid(),
  subjectType: z.nativeEnum(RatingSubjectType),
  subjectId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});
export type CreateRatingDto = z.infer<typeof createRatingSchema>;

export interface RatingSnapshot {
  id: string;
  buyerId: string;
  orderId: string;
  eventId: string;
  restaurantId: string;
  subjectType: RatingSubjectType;
  subjectId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

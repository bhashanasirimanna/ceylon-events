import type {
  EventStatus,
  SeatMapSnapshot,
  SeatStatus,
} from "@ceylon/shared-types";

// Local mirrors of the response shapes returned by event-service and
// venue-service over HTTP. This service has no DB-level relation to those
// entities — it only ever sees them as JSON across the wire.
export interface UpstreamEvent {
  id: string;
  restaurantId: string;
  seatMapVersionId: string | null;
  title: string;
  status: EventStatus;
  startsAt: string;
}

export interface UpstreamTicketTier {
  id: string;
  eventId: string;
  name: string;
  priceMinorUnits: number;
  currency: string;
  saleStartAt: string | null;
  saleEndAt: string | null;
  allowedSectionIds: string[] | null;
  quantityLimit: number | null;
}

export type UpstreamSeatMapSnapshot = SeatMapSnapshot;
export type UpstreamAvailability = Record<string, SeatStatus>;

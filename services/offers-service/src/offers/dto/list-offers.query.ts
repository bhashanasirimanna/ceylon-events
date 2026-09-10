import { IsUUID } from "class-validator";

export class ListOffersQuery {
  @IsUUID()
  eventId: string;
}

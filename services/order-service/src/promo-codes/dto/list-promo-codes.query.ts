import { IsUUID } from "class-validator";

export class ListPromoCodesQuery {
  @IsUUID()
  eventId: string;
}

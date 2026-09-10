import { IsUUID } from "class-validator";

export class ListSeatMapsQuery {
  @IsUUID()
  restaurantId: string;
}

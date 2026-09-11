import { FoodOrderStatus } from "@ceylon/shared-types";
import { IsIn, IsOptional, IsUUID } from "class-validator";

export class ListByEventQuery {
  @IsOptional()
  @IsIn(Object.values(FoodOrderStatus))
  status?: FoodOrderStatus;

  // Scopes the listing to one table — used by the staff table detail page
  // so it doesn't have to fetch every order for the event and filter
  // client-side.
  @IsOptional()
  @IsUUID()
  tableId?: string;
}

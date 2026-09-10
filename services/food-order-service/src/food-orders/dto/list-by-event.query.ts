import { FoodOrderStatus } from "@ceylon/shared-types";
import { IsIn, IsOptional } from "class-validator";

export class ListByEventQuery {
  @IsOptional()
  @IsIn(Object.values(FoodOrderStatus))
  status?: FoodOrderStatus;
}

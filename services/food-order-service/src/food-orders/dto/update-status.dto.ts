import { FoodOrderStatus } from "@ceylon/shared-types";
import { IsEnum } from "class-validator";

export class UpdateFoodOrderStatusDto {
  @IsEnum(FoodOrderStatus)
  status: FoodOrderStatus;
}

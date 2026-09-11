import { FoodOrderStatus } from "@ceylon/shared-types";
import { ArrayMinSize, IsArray, IsEnum, IsUUID } from "class-validator";

export class BulkUpdateFoodOrderStatusDto {
  // The food-pre-order's own id, not orderItemId — a waiter-created order
  // has no order item to key off of, so this is the one identifier every
  // food order (either source) always has.
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  ids: string[];

  @IsEnum(FoodOrderStatus)
  status: FoodOrderStatus;
}

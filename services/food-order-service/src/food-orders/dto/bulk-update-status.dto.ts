import { FoodOrderStatus } from "@ceylon/shared-types";
import { ArrayMinSize, IsArray, IsEnum, IsUUID } from "class-validator";

export class BulkUpdateFoodOrderStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  orderItemIds: string[];

  @IsEnum(FoodOrderStatus)
  status: FoodOrderStatus;
}

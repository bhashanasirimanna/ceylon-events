import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from "class-validator";
import { FoodPreOrderItemInputDto } from "./food-pre-order-item-input.dto";

export class SubmitFoodPreOrderDto {
  @IsUUID()
  orderId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FoodPreOrderItemInputDto)
  items: FoodPreOrderItemInputDto[];
}

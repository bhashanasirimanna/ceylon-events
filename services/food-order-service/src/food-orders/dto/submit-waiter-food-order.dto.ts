import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { FoodPreOrderItemInputDto } from "./food-pre-order-item-input.dto";

// Deliberately has no restaurantId, tableLabel, prices, waiterUserId, or
// source — all resolved server-side (see FoodOrdersService.createWaiterOrder)
// from the authenticated caller, the event/table records, and the
// restaurant's own menu. Nothing authoritative comes from this body.
export class SubmitWaiterFoodOrderDto {
  @IsUUID()
  eventId: string;

  @IsUUID()
  tableId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FoodPreOrderItemInputDto)
  items: FoodPreOrderItemInputDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  clientRequestId?: string;
}

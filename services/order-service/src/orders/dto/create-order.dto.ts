import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsUUID, ValidateNested } from "class-validator";
import { PaymentMethod } from "@ceylon/shared-types";
import { OrderItemInputDto } from "./order-item-input.dto";

export class CreateOrderDto {
  @IsUUID()
  eventId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];
}

import { Type } from "class-transformer";
import { IsUUID, ValidateNested } from "class-validator";
import { BillingDetailsDto } from "./billing-details.dto";

export class InitiatePaymentDto {
  @IsUUID()
  orderId: string;

  @ValidateNested()
  @Type(() => BillingDetailsDto)
  billing: BillingDetailsDto;
}

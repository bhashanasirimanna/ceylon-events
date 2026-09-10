import { DiscountType } from "@ceylon/shared-types";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";

export class CreatePromoCodeDto {
  @IsUUID()
  eventId: string;

  @IsString()
  @MinLength(1)
  code: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsInt()
  @Min(0)
  discountValue: number;

  @IsOptional()
  @IsUUID()
  applicableTicketTierId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

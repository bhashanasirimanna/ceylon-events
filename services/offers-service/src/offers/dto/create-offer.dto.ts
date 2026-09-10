import { DiscountType, RedemptionType } from "@ceylon/shared-types";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateOfferDto {
  @IsUUID()
  eventId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsInt()
  @Min(0)
  discountValue: number;

  @IsEnum(RedemptionType)
  redemptionType: RedemptionType;

  @ValidateIf((dto) => dto.redemptionType === RedemptionType.CAPPED)
  @IsInt()
  @Min(1)
  redemptionCap?: number | null;

  @IsOptional()
  @IsUUID()
  applicableMenuCategoryId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  applicableMenuItemIds?: string[] | null;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  ticketTierIds: string[];
}

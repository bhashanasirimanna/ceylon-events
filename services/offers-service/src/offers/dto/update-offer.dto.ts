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
} from "class-validator";

export class UpdateOfferDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsEnum(RedemptionType)
  redemptionType?: RedemptionType;

  @IsOptional()
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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  ticketTierIds?: string[];
}

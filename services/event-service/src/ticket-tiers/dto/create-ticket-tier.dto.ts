import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  MinLength,
} from "class-validator";

export class CreateTicketTierDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(0)
  priceMinorUnits: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string = "LKR";

  @IsOptional()
  @IsDateString()
  saleStartAt?: string | null;

  @IsOptional()
  @IsDateString()
  saleEndAt?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  allowedSectionIds?: string[] | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantityLimit?: number | null;
}

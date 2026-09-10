import { TableShape } from "@ceylon/shared-types";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";

export class UpdateTableDto {
  @IsOptional()
  @IsUUID()
  sectionId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  tableNumber?: string;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @IsEnum(TableShape)
  shape?: TableShape;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

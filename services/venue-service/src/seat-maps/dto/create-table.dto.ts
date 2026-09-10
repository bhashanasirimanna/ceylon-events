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

export class CreateTableDto {
  @IsOptional()
  @IsUUID()
  sectionId?: string | null;

  @IsString()
  @MinLength(1)
  tableNumber: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsOptional()
  @IsEnum(TableShape)
  shape?: TableShape = TableShape.RECT;

  @IsInt()
  @Min(1)
  capacity: number;
}

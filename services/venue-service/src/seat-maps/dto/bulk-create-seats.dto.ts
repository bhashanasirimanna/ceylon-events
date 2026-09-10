import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";

export class SeatInputDto {
  @IsString()
  @MinLength(1)
  seatLabel: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class BulkCreateSeatsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SeatInputDto)
  seats: SeatInputDto[];
}

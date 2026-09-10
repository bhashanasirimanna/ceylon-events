import { IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateSeatDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  seatLabel?: string;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;
}

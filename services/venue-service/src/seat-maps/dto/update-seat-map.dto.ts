import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateSeatMapDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  canvasWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  canvasHeight?: number;
}

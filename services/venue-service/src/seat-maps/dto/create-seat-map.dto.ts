import { Type } from "class-transformer";
import { IsInt, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateSeatMapDto {
  @IsUUID()
  restaurantId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  canvasWidth: number = 1200;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  canvasHeight: number = 800;
}

import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class ListEventsQuery {
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}

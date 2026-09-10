import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";
import { RatingSubjectType } from "@ceylon/shared-types";

export class RatingsFilterQuery {
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @IsEnum(RatingSubjectType)
  subjectType?: RatingSubjectType;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

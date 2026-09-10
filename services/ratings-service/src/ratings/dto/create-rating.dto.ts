import { RatingSubjectType } from "@ceylon/shared-types";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateRatingDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  eventId: string;

  @IsEnum(RatingSubjectType)
  subjectType: RatingSubjectType;

  @IsUUID()
  subjectId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

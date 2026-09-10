import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreateEventDto {
  @IsUUID()
  restaurantId: string;

  @IsOptional()
  @IsUUID()
  seatMapVersionId?: string | null;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bannerImageUrl?: string;

  @IsDateString()
  startsAt: string;
}

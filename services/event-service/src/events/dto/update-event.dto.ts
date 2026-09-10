import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class UpdateEventDto {
  @IsOptional()
  @IsUUID()
  seatMapVersionId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bannerImageUrl?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;
}

import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateRestaurantDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  address: string;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

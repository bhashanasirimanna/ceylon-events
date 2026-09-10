import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class BillingDetailsDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  phone: string;

  @IsString()
  @MinLength(1)
  address: string;

  @IsString()
  @MinLength(1)
  city: string;

  @IsOptional()
  @IsString()
  country?: string = "Sri Lanka";
}

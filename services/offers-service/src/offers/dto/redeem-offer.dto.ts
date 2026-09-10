import { IsOptional, IsString, MinLength } from "class-validator";

export class RedeemOfferDto {
  @IsString()
  @MinLength(1)
  qrToken: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

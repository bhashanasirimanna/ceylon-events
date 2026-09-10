import { IsOptional, IsString } from "class-validator";

export class ReviewPaymentProofDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

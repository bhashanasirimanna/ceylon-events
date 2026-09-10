import { IsString, MinLength } from "class-validator";

export class SubmitPaymentProofDto {
  @IsString()
  @MinLength(1)
  objectKey: string;

  @IsString()
  @MinLength(1)
  publicUrl: string;

  @IsString()
  @MinLength(1)
  referenceNote: string;
}

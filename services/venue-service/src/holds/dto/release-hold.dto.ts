import { IsString, MinLength } from "class-validator";

export class ReleaseHoldDto {
  @IsString()
  @MinLength(1)
  holderToken: string;
}

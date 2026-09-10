import { IsNotEmpty, IsString } from "class-validator";

export class ConfirmUploadDto {
  @IsString()
  @IsNotEmpty()
  objectKey: string;
}

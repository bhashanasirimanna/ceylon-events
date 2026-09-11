import { IsEmail, IsString, MinLength } from "class-validator";

export class SendEmailInternalDto {
  @IsEmail()
  to: string;

  @IsString()
  @MinLength(1)
  subject: string;

  @IsString()
  @MinLength(1)
  html: string;
}

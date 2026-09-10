import { NotificationType } from "@ceylon/shared-types";
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateNotificationInternalDto {
  @IsUUID()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

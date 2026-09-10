import { IsOptional, IsUUID } from "class-validator";

export class MarkSoldDto {
  @IsOptional()
  @IsUUID()
  orderId?: string;
}

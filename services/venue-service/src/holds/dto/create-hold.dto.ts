import { IsUUID } from "class-validator";

export class CreateHoldDto {
  @IsUUID()
  seatId: string;
}

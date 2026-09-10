import { IsOptional, IsString, IsUUID } from "class-validator";

export class OrderItemInputDto {
  @IsUUID()
  ticketTierId: string;

  @IsOptional()
  @IsUUID()
  seatId?: string | null;

  // Required when seatId is set — proves the buyer currently holds that
  // seat (see the Venue/Seating Service's Redis hold-lock mechanism).
  @IsOptional()
  @IsString()
  holderToken?: string | null;
}

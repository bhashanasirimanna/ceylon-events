import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { UpdateSeatDto } from "./dto/update-seat.dto";
import { SeatMapsService } from "./seat-maps.service";

const SEAT_MAP_MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("seats/:id")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SEAT_MAP_MANAGER_ROLES)
export class SeatsController {
  constructor(private readonly seatMapsService: SeatMapsService) {}

  @Patch()
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSeatDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.updateSeat(id, dto, caller);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.seatMapsService.deleteSeat(id, caller);
  }
}

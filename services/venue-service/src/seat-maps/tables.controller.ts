import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { BulkCreateSeatsDto } from "./dto/bulk-create-seats.dto";
import { UpdateTableDto } from "./dto/update-table.dto";
import { SeatMapsService } from "./seat-maps.service";

const SEAT_MAP_MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("tables/:id")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SEAT_MAP_MANAGER_ROLES)
export class TablesController {
  constructor(private readonly seatMapsService: SeatMapsService) {}

  @Patch()
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTableDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.updateTable(id, dto, caller);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.seatMapsService.deleteTable(id, caller);
  }

  @Post("seats")
  bulkCreateSeats(
    @Param("id") id: string,
    @Body() dto: BulkCreateSeatsDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.bulkCreateSeats(id, dto, caller);
  }
}

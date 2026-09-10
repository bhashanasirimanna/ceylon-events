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
import { UpdateSectionDto } from "./dto/update-section.dto";
import { SeatMapsService } from "./seat-maps.service";

const SEAT_MAP_MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("sections/:id")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SEAT_MAP_MANAGER_ROLES)
export class SectionsController {
  constructor(private readonly seatMapsService: SeatMapsService) {}

  @Patch()
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.updateSection(id, dto, caller);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.seatMapsService.deleteSection(id, caller);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { CreateSectionDto } from "./dto/create-section.dto";
import { CreateTableDto } from "./dto/create-table.dto";
import { UpdateSeatMapDto } from "./dto/update-seat-map.dto";
import { SeatMapsService } from "./seat-maps.service";

const SEAT_MAP_MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("seat-maps/:id")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SEAT_MAP_MANAGER_ROLES)
export class SeatMapsController {
  constructor(private readonly seatMapsService: SeatMapsService) {}

  @Get()
  getDefinition(
    @Param("id") id: string,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.getFullDefinition(id, caller);
  }

  @Patch()
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSeatMapDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.updateSeatMap(id, dto, caller);
  }

  @Post("sections")
  createSection(
    @Param("id") id: string,
    @Body() dto: CreateSectionDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.createSection(id, dto, caller);
  }

  @Post("tables")
  createTable(
    @Param("id") id: string,
    @Body() dto: CreateTableDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.createTable(id, dto, caller);
  }

  @Post("publish")
  publish(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.seatMapsService.publish(id, caller);
  }

  @Get("versions")
  listVersions(
    @Param("id") id: string,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.listVersions(id, caller);
  }
}

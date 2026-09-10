import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { CreateSeatMapDto } from "./dto/create-seat-map.dto";
import { ListSeatMapsQuery } from "./dto/list-seat-maps.query";
import { SeatMapsService } from "./seat-maps.service";

const SEAT_MAP_MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

// Deliberately NOT nested under /restaurants/:id/... — the API Gateway
// routes by first path segment, and /restaurants/* is already owned by the
// Restaurant Service. Seat maps live entirely under /seat-maps instead,
// with restaurantId passed explicitly.
@Controller("seat-maps")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SEAT_MAP_MANAGER_ROLES)
export class RestaurantSeatMapsController {
  constructor(private readonly seatMapsService: SeatMapsService) {}

  @Post()
  create(
    @Body() dto: CreateSeatMapDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.createSeatMap(dto.restaurantId, dto, caller);
  }

  @Get()
  list(
    @Query() query: ListSeatMapsQuery,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.seatMapsService.listByRestaurant(query.restaurantId, caller);
  }
}

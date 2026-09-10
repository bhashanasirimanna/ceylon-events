import { Controller, Get, Headers, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole } from "@ceylon/shared-types";
import { ReportsService } from "./reports.service";

const RESTAURANT_STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("events/:eventId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  eventReport(
    @Param("eventId") eventId: string,
    @Headers("authorization") authorizationHeader: string,
  ) {
    return this.reportsService.eventReport(eventId, authorizationHeader);
  }

  @Get("restaurants/:restaurantId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  restaurantReport(
    @Param("restaurantId") restaurantId: string,
    @Headers("authorization") authorizationHeader: string,
  ) {
    return this.reportsService.restaurantReport(restaurantId, authorizationHeader);
  }

  @Get("platform")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  platformTotals(@Headers("authorization") authorizationHeader: string) {
    return this.reportsService.platformTotals(authorizationHeader);
  }
}

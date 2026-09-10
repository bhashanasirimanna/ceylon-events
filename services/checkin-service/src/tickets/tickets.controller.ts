import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { TicketsService } from "./tickets.service";

const DOOR_STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get("for-order/:orderId")
  @UseGuards(JwtAuthGuard)
  getForOrder(
    @Param("orderId") orderId: string,
    @Headers("authorization") authorizationHeader: string,
  ) {
    return this.ticketsService.getForOrder(orderId, authorizationHeader);
  }

  @Get(":qrToken/lookup")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...DOOR_STAFF_ROLES)
  lookup(
    @Param("qrToken") qrToken: string,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.ticketsService.lookup(qrToken, caller);
  }

  @Post(":qrToken/check-in")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...DOOR_STAFF_ROLES)
  checkIn(
    @Param("qrToken") qrToken: string,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.ticketsService.checkIn(qrToken, caller);
  }
}

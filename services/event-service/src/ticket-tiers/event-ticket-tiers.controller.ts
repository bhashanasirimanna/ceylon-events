import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { CreateTicketTierDto } from "./dto/create-ticket-tier.dto";
import { TicketTiersService } from "./ticket-tiers.service";

const EVENT_MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("events/:eventId/ticket-tiers")
export class EventTicketTiersController {
  constructor(private readonly tiersService: TicketTiersService) {}

  // Public — event detail pages need this to show ticket options.
  @Get()
  list(@Param("eventId") eventId: string) {
    return this.tiersService.listForEvent(eventId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...EVENT_MANAGER_ROLES)
  create(
    @Param("eventId") eventId: string,
    @Body() dto: CreateTicketTierDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.tiersService.create(eventId, dto, caller);
  }
}

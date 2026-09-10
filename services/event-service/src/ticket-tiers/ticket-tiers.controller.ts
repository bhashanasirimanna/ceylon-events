import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { UpdateTicketTierDto } from "./dto/update-ticket-tier.dto";
import { TicketTiersService } from "./ticket-tiers.service";

const EVENT_MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("ticket-tiers/:id")
export class TicketTiersController {
  constructor(private readonly tiersService: TicketTiersService) {}

  // Public — the Order/Ticketing Service calls this to validate price and
  // sale window at checkout time.
  @Get()
  findOne(@Param("id") id: string) {
    return this.tiersService.findByIdOrThrow(id);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...EVENT_MANAGER_ROLES)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTicketTierDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.tiersService.update(id, dto, caller);
  }

  @Delete()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...EVENT_MANAGER_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.tiersService.delete(id, caller);
  }
}

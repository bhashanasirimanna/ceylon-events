import { Body, Controller, Get, Patch, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { CreatePromoCodeDto } from "./dto/create-promo-code.dto";
import { ListPromoCodesQuery } from "./dto/list-promo-codes.query";
import { UpdatePromoCodeDto } from "./dto/update-promo-code.dto";
import { ValidatePromoCodeQuery } from "./dto/validate-promo-code.query";
import { PromoCodesService } from "./promo-codes.service";

const RESTAURANT_STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

// Deliberately its own top-level prefix rather than nested under
// /events/:eventId/... or /orders/... — the API Gateway routes by first
// path segment, and both of those are already owned by other services'
// controllers. eventId is passed explicitly (body on create, query on
// list/validate) — same reasoning as offers-service's controller.
@Controller("promo-codes")
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  create(@Body() dto: CreatePromoCodeDto, @CurrentUser() caller: JwtAccessPayload) {
    return this.promoCodesService.create(dto.eventId, dto, caller);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  listForEvent(
    @Query() query: ListPromoCodesQuery,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.promoCodesService.listForEvent(query.eventId, caller);
  }

  // Any authenticated buyer can preview a code's discount before checkout.
  @Get("validate")
  @UseGuards(JwtAuthGuard)
  validate(@Query() query: ValidatePromoCodeQuery) {
    return this.promoCodesService.validate(query.eventId, query.code);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePromoCodeDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.promoCodesService.update(id, dto, caller);
  }
}

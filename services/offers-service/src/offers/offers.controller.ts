import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { ListOffersQuery } from "./dto/list-offers.query";
import { RedeemOfferDto } from "./dto/redeem-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { OffersService } from "./offers.service";

const RESTAURANT_STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

// Deliberately NOT nested under /events/:eventId/... — the API Gateway
// routes by first path segment, and /events/* is already owned by the
// Event Service. Offers live entirely under /offers instead, with
// eventId passed explicitly (body on create, query on list) — same
// reasoning as venue-service's seat-maps controller.
@Controller("offers")
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  create(@Body() dto: CreateOfferDto, @CurrentUser() caller: JwtAccessPayload) {
    return this.offersService.create(dto.eventId, dto, caller);
  }

  // Public — buyers see what perks come bundled with a ticket tier
  // before/after purchase.
  @Get()
  listForEvent(@Query() query: ListOffersQuery) {
    return this.offersService.listForEvent(query.eventId);
  }

  @Get("by-ticket-tier/:ticketTierId")
  listForTicketTier(@Param("ticketTierId") ticketTierId: string) {
    return this.offersService.listForTicketTier(ticketTierId);
  }

  @Get("for-ticket/:qrToken")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  offersForTicket(
    @Param("qrToken") qrToken: string,
    @Headers("authorization") authorizationHeader: string,
  ) {
    return this.offersService.offersForTicket(qrToken, authorizationHeader);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.offersService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateOfferDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.offersService.update(id, dto, caller);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.offersService.delete(id, caller);
  }

  @Get(":id/redemptions")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  listRedemptions(
    @Param("id") id: string,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.offersService.listRedemptions(id, caller);
  }

  @Post(":offerId/redeem")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  redeem(
    @Param("offerId") offerId: string,
    @Body() dto: RedeemOfferDto,
    @CurrentUser() caller: JwtAccessPayload,
    @Headers("authorization") authorizationHeader: string,
  ) {
    return this.offersService.redeem(
      offerId,
      dto.qrToken,
      dto.notes,
      caller,
      authorizationHeader,
    );
  }
}

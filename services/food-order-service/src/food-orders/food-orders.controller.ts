import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type FoodPreOrderSnapshot, type JwtAccessPayload } from "@ceylon/shared-types";
import { Observable, map } from "rxjs";
import { SseQueryJwtGuard } from "../common/sse-query-jwt.guard";
import { BulkUpdateFoodOrderStatusDto } from "./dto/bulk-update-status.dto";
import { ListByEventQuery } from "./dto/list-by-event.query";
import { SubmitFoodPreOrderDto } from "./dto/submit-food-pre-order.dto";
import { SubmitWaiterFoodOrderDto } from "./dto/submit-waiter-food-order.dto";
import { UpdateFoodOrderStatusDto } from "./dto/update-status.dto";
import { FoodOrdersService } from "./food-orders.service";
import { FoodOrdersRealtimeService } from "./realtime/food-orders-realtime.service";

const RESTAURANT_STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("food-pre-orders")
export class FoodOrdersController {
  constructor(
    private readonly foodOrdersService: FoodOrdersService,
    private readonly realtimeService: FoodOrdersRealtimeService,
  ) {}

  @Patch("by-order-item/:orderItemId")
  @UseGuards(JwtAuthGuard)
  submit(
    @Param("orderItemId") orderItemId: string,
    @Body() dto: SubmitFoodPreOrderDto,
    @Headers("authorization") authorizationHeader: string,
  ) {
    return this.foodOrdersService.submit(orderItemId, dto, authorizationHeader);
  }

  @Get("by-order-item/:orderItemId")
  @UseGuards(JwtAuthGuard)
  getForOrderItem(
    @Param("orderItemId") orderItemId: string,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.foodOrdersService.getForOrderItem(orderItemId, caller);
  }

  @Patch("by-order-item/:orderItemId/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  updateStatus(
    @Param("orderItemId") orderItemId: string,
    @Body() dto: UpdateFoodOrderStatusDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.foodOrdersService.updateStatus(orderItemId, dto, caller);
  }

  // Keyed by the food order's own id, not orderItemId — the one
  // identifier both PRE_ORDER and WAITER-sourced orders always have.
  @Patch(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  updateStatusById(
    @Param("id") id: string,
    @Body() dto: UpdateFoodOrderStatusDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.foodOrdersService.updateStatusById(id, dto, caller);
  }

  @Patch("bulk-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  bulkUpdateStatus(
    @Body() dto: BulkUpdateFoodOrderStatusDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.foodOrdersService.bulkUpdateStatus(dto, caller);
  }

  // Staff/waiter table-order creation. Authorization and every
  // authoritative value (restaurant, table eligibility, menu item
  // prices, source, staff identity) are resolved server-side in the
  // service — nothing from the body is trusted as-is.
  @Post("staff")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  createWaiterOrder(
    @Body() dto: SubmitWaiterFoodOrderDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.foodOrdersService.createWaiterOrder(dto, caller);
  }

  @Get("by-event/:eventId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  listForEvent(
    @Param("eventId") eventId: string,
    @Query() query: ListByEventQuery,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.foodOrdersService.listForEvent(
      eventId,
      query.status,
      caller,
      query.tableId,
    );
  }

  @Get("by-event/:eventId/summary")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  summaryForEvent(
    @Param("eventId") eventId: string,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.foodOrdersService.summaryForEvent(eventId, caller);
  }

  // Native EventSource sends no request body and can't set an
  // Authorization header, so auth here comes from a `?token=` query
  // param (see SseQueryJwtGuard) rather than the usual Bearer header.
  @Sse("by-event/:eventId/stream")
  @UseGuards(SseQueryJwtGuard, RolesGuard)
  @Roles(...RESTAURANT_STAFF_ROLES)
  async stream(
    @Param("eventId") eventId: string,
    @CurrentUser() caller: JwtAccessPayload,
  ): Promise<Observable<{ data: FoodPreOrderSnapshot }>> {
    await this.foodOrdersService.assertCanManageEvent(eventId, caller);
    return this.realtimeService
      .streamForEvent(eventId)
      .pipe(map((foodPreOrder) => ({ data: foodPreOrder })));
  }
}

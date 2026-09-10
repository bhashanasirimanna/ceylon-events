import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersQuery } from "./dto/list-orders.query";
import { OrdersService } from "./orders.service";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() caller: JwtAccessPayload) {
    return this.ordersService.create(dto, caller);
  }

  @Get("me")
  findMine(@CurrentUser() caller: JwtAccessPayload) {
    return this.ordersService.findMine(caller.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  findAll(@Query() query: ListOrdersQuery) {
    return this.ordersService.findAll(query.page ?? 1, query.pageSize ?? 20);
  }

  @Get(":id")
  findOne(
    @Param("id") id: string,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.ordersService.findOneOrThrow(id, caller);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.ordersService.cancel(id, caller);
  }
}

import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { InternalAuthGuard } from "@ceylon/nest-common";
import { OrdersService } from "./orders.service";

// Separate from OrdersController (which guards its whole class with
// JwtAuthGuard) so this service-to-service route authenticates only via
// the internal shared secret, never a buyer's JWT.
@Controller("internal/orders")
@UseGuards(InternalAuthGuard)
export class InternalOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Called by the Payment Service to look up order details while
  // processing a PayHere webhook, which carries no buyer JWT to present.
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ordersService.findByIdInternal(id);
  }

  // Called by the Payment Service once a payment actually confirms
  // (Phase 4).
  @Patch(":id/confirm-payment")
  confirmPayment(@Param("id") id: string) {
    return this.ordersService.confirmPayment(id);
  }
}

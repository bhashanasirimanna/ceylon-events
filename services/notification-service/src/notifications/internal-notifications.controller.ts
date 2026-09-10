import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { InternalAuthGuard } from "@ceylon/nest-common";
import { CreateNotificationInternalDto } from "./dto/create-notification-internal.dto";
import { NotificationsService } from "./notifications.service";

// Separate from NotificationsController (whose routes each guard with the
// normal Bearer-JWT JwtAuthGuard) so this service-to-service route
// authenticates only via the internal shared secret — called by
// order-service, payment-service, and food-order-service when a domain
// event happens that a buyer should be told about.
@Controller("internal/notifications")
@UseGuards(InternalAuthGuard)
export class InternalNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  create(@Body() dto: CreateNotificationInternalDto) {
    return this.notificationsService.createInternal(dto);
  }
}

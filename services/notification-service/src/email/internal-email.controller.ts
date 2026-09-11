import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { InternalAuthGuard } from "@ceylon/nest-common";
import { SendEmailInternalDto } from "./dto/send-email-internal.dto";
import { EmailService } from "./email.service";

// Service-to-service only, same pattern as InternalNotificationsController —
// identity-service calls this to deliver a restaurant-owner invite link;
// nothing about this depends on the in-app Notification/inbox model,
// since the recipient usually has no account (or no active session) yet.
@Controller("internal/email")
@UseGuards(InternalAuthGuard)
export class InternalEmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async send(@Body() dto: SendEmailInternalDto) {
    await this.emailService.send(dto);
  }
}

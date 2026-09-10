import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Notification } from "./entities/notification.entity";
import { InternalNotificationsController } from "./internal-notifications.controller";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsRealtimeService } from "./realtime/notifications-realtime.service";
import { SseQueryJwtGuard } from "../common/sse-query-jwt.guard";

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), JwtModule.register({})],
  controllers: [NotificationsController, InternalNotificationsController],
  providers: [NotificationsService, NotificationsRealtimeService, SseQueryJwtGuard],
})
export class NotificationsModule {}

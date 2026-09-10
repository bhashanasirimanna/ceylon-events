import { Controller, Get, Param, Patch, Query, Sse, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "@ceylon/nest-common";
import type { JwtAccessPayload, NotificationSnapshot } from "@ceylon/shared-types";
import { Observable, map } from "rxjs";
import { SseQueryJwtGuard } from "../common/sse-query-jwt.guard";
import { ListNotificationsQuery } from "./dto/list-notifications.query";
import { NotificationsService } from "./notifications.service";
import { NotificationsRealtimeService } from "./realtime/notifications-realtime.service";

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: NotificationsRealtimeService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(
    @Query() query: ListNotificationsQuery,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.notificationsService.listForUser(
      caller.sub,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  @Patch("read-all")
  @UseGuards(JwtAuthGuard)
  markAllRead(@CurrentUser() caller: JwtAccessPayload) {
    return this.notificationsService.markAllRead(caller.sub);
  }

  @Patch(":id/read")
  @UseGuards(JwtAuthGuard)
  markRead(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.notificationsService.markRead(id, caller.sub);
  }

  // Native EventSource sends no request body and can't set an
  // Authorization header, so auth here comes from a `?token=` query
  // param (see SseQueryJwtGuard) rather than the usual Bearer header —
  // same pattern as food-order-service's live dashboard stream.
  @Sse("stream")
  @UseGuards(SseQueryJwtGuard)
  stream(
    @CurrentUser() caller: JwtAccessPayload,
  ): Observable<{ data: NotificationSnapshot }> {
    return this.realtimeService
      .streamForUser(caller.sub)
      .pipe(map((notification) => ({ data: notification })));
  }
}

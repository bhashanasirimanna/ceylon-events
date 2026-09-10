import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import type {
  NotificationListResult,
  NotificationSnapshot,
} from "@ceylon/shared-types";
import { CreateNotificationInternalDto } from "./dto/create-notification-internal.dto";
import { Notification } from "./entities/notification.entity";
import { NotificationsRealtimeService } from "./realtime/notifications-realtime.service";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly realtimeService: NotificationsRealtimeService,
  ) {}

  private toSnapshot(notification: Notification): NotificationSnapshot {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: notification.metadata,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    };
  }

  /** Called only by other backend services (see InternalNotificationsController). */
  async createInternal(
    dto: CreateNotificationInternalDto,
  ): Promise<NotificationSnapshot> {
    const notification = await this.notificationsRepository.save(
      this.notificationsRepository.create({
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        metadata: dto.metadata ?? null,
      }),
    );
    const snapshot = this.toSnapshot(notification);
    this.realtimeService.publish(dto.userId, snapshot);
    return snapshot;
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<NotificationListResult> {
    const [items, total] = await this.notificationsRepository.findAndCount({
      where: { userId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const unreadCount = await this.notificationsRepository.count({
      where: { userId, readAt: IsNull() },
    });
    return {
      items: items.map((notification) => this.toSnapshot(notification)),
      total,
      unreadCount,
      page,
      pageSize,
    };
  }

  async markRead(id: string, userId: string): Promise<NotificationSnapshot> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException("You may not modify this notification");
    }
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }
    return this.toSnapshot(notification);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => "now()" })
      .where("user_id = :userId AND read_at IS NULL", { userId })
      .execute();
  }
}

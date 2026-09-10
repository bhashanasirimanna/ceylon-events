import { z } from "zod";
import { NotificationType } from "./enums";

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.nativeEnum(NotificationType),
  title: z.string().min(1),
  body: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type CreateNotificationDto = z.infer<typeof createNotificationSchema>;

export interface NotificationSnapshot {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationSnapshot[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

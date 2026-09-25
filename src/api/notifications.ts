import type { ChatPalezApiClient } from './client';

export type NotificationItem = {
  notification_id: number | string;
  name?: string;
  message?: string;
  url?: string;
  user_picture?: string;
  action?: string;
  time?: string;
  [key: string]: unknown;
};

export class NotificationsService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async getNotifications(offset = 0, lastNotificationId?: number | string): Promise<NotificationItem[]> {
    const query: Record<string, string | number> = { offset };
    if (lastNotificationId !== undefined) query.last_notification_id = lastNotificationId;
    return this.api.get<NotificationItem[]>('notifications', query);
  }
}

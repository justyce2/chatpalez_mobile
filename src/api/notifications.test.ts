import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications';
import type { ChatPalezApiClient } from './client';

describe('NotificationsService', () => {
  it('loads notifications from the audited adapter with an optional cursor', async () => {
    const get = vi.fn().mockResolvedValue([]);
    const api = { get } as unknown as ChatPalezApiClient;
    const notifications = new NotificationsService(api);

    await notifications.getNotifications(2, 71);

    expect(get).toHaveBeenCalledWith('notifications', { offset: 2, last_notification_id: 71 });
  });

  it('does not send an undefined notification cursor', async () => {
    const get = vi.fn().mockResolvedValue([]);
    const api = { get } as unknown as ChatPalezApiClient;
    const notifications = new NotificationsService(api);

    await notifications.getNotifications();

    expect(get).toHaveBeenCalledWith('notifications', { offset: 0 });
  });
});

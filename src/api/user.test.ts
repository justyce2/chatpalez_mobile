import { describe, expect, it, vi } from 'vitest';
import { UserService } from './user';
import type { ChatPalezApiClient } from './client';

describe('UserService', () => {
  it('uses the official blocked-users, deletion, and OneSignal routes', async () => {
    const getPage = vi.fn().mockResolvedValue({ data: [], hasMore: true });
    const post = vi.fn().mockResolvedValue(undefined);
    const api = { getPage, post } as unknown as ChatPalezApiClient;
    const users = new UserService(api);

    await expect(users.getBlockedUsersPage(2)).resolves.toEqual({ data: [], hasMore: true });
    await users.deleteAccount('current-password');
    await users.updateOneSignalId('subscription-id');

    expect(getPage).toHaveBeenCalledWith('user/blocked', { offset: 2 });
    expect(post).toHaveBeenNthCalledWith(1, 'user/delete', { password: 'current-password' });
    expect(post).toHaveBeenNthCalledWith(2, 'user/onesignal', { onesignal_id: 'subscription-id' });
  });
});

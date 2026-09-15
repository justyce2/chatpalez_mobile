import type { ChatPalezApiClient } from './client';

export type BlockedUser = {
  user_id: number | string;
  user_name?: string;
  user_firstname?: string;
  user_lastname?: string;
  user_picture?: string;
  [key: string]: unknown;
};

export class UserService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async getBlockedUsers(offset = 0): Promise<BlockedUser[]> {
    return this.api.get<BlockedUser[]>('user/blocked', { offset });
  }

  async deleteAccount(password: string): Promise<void> {
    await this.api.post<unknown>('user/delete', { password });
  }

  async updateOneSignalId(oneSignalId: string): Promise<void> {
    await this.api.post<unknown>('user/onesignal', { onesignal_id: oneSignalId });
  }
}

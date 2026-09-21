import type { ApiPage, ChatPalezApiClient } from './client';

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
    return (await this.getBlockedUsersPage(offset)).data;
  }

  async getBlockedUsersPage(offset = 0): Promise<ApiPage<BlockedUser[]>> {
    return this.api.getPage<BlockedUser[]>('user/blocked', { offset });
  }

  async connect(action: string, id: number | string, uid?: number | string): Promise<void> {
    await this.api.post<unknown>('user/connect', { do: action, id, uid: uid ?? 0 });
  }

  async deleteAccount(password: string): Promise<void> {
    await this.api.post<unknown>('user/delete', { password });
  }

  async updateOneSignalId(oneSignalId: string): Promise<void> {
    await this.api.post<unknown>('user/onesignal', { onesignal_id: oneSignalId });
  }
}

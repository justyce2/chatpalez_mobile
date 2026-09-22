import type { ApiPage, ChatPalezApiClient } from './client';

export type UserProfile = {
  user_id: number | string;
  user_name?: string | null;
  user_firstname?: string | null;
  user_lastname?: string | null;
  user_fullname?: string | null;
  user_picture?: string | null;
  user_cover?: string | null;
  user_biography?: string | null;
  user_gender?: string | null;
  user_birthdate?: string | null;
  user_relationship?: string | null;
  user_work_title?: string | null;
  user_work_place?: string | null;
  user_current_city?: string | null;
  user_hometown?: string | null;
  user_verified?: boolean;
  user_subscribed?: boolean;
  friends_count?: number | string | null;
  followers_count?: number | string | null;
  followings_count?: number | string | null;
  [key: string]: unknown;
};

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

  async getProfile(): Promise<UserProfile> {
    return this.api.get<UserProfile>('user/profile');
  }

  async getBlockedUsers(offset = 0): Promise<BlockedUser[]> {
    return (await this.getBlockedUsersPage(offset)).data;
  }

  async getBlockedUsersPage(offset = 0): Promise<ApiPage<BlockedUser[]>> {
    return this.api.getPage<BlockedUser[]>('user/blocked', { offset });
  }

  async deleteAccount(password: string): Promise<void> {
    await this.api.post<unknown>('user/delete', { password });
  }

  async updateOneSignalId(oneSignalId: string): Promise<void> {
    await this.api.post<unknown>('user/onesignal', { onesignal_id: oneSignalId });
  }
}

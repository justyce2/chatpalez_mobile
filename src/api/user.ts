import type { ApiPage, ChatPalezApiClient } from './client';

export type BlockedUser = {
  user_id: number | string;
  user_name?: string;
  user_firstname?: string;
  user_lastname?: string;
  user_picture?: string;
  [key: string]: unknown;
};

export type MobileAccount = {
  user_id: number | string;
  username?: string;
  email?: string;
  phone?: string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  picture?: string;
  biography?: string;
  website?: string;
  gender?: number | string | null;
  country?: number | string | null;
  relationship?: string | null;
  birth_month?: number | null;
  birth_day?: number | null;
  birth_year?: number | null;
  work_title?: string;
  work_place?: string;
  work_url?: string;
  city?: string;
  hometown?: string;
  edu_major?: string;
  edu_school?: string;
  edu_class?: string;
  facebook?: string;
  twitter?: string;
  youtube?: string;
  instagram?: string;
  twitch?: string;
  linkedin?: string;
  vkontakte?: string;
  username_changes_disabled?: boolean;
  show_usernames_enabled?: boolean;
  genders_disabled?: boolean;
  work_info_enabled?: boolean;
  location_info_enabled?: boolean;
  education_info_enabled?: boolean;
  social_info_enabled?: boolean;
  two_factor_enabled?: boolean;
  two_factor_type?: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
  privacy?: {
    user_chat_enabled?: boolean;
    user_newsletter_enabled?: boolean;
    user_tips_enabled?: boolean;
    user_suggestions_hidden?: boolean;
    user_incognito_enabled?: boolean;
    user_privacy_chat?: string;
    user_privacy_wall?: string;
    user_privacy_friends?: string;
    user_privacy_followers?: string;
    user_privacy_photos?: string;
    user_privacy_pages?: string;
    user_privacy_groups?: string;
    user_privacy_events?: string;
  };
};

export type ProfileUpdate = Partial<Pick<MobileAccount,
  'firstname' | 'lastname' | 'gender' | 'country' | 'relationship' |
  'birth_month' | 'birth_day' | 'birth_year' | 'biography' | 'website'>>;

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

  getAccount(): Promise<MobileAccount> {
    return this.api.get<MobileAccount>('mobile/account');
  }

  async updateProfile(payload: ProfileUpdate): Promise<void> {
    await this.api.post<unknown>('mobile/account/profile', payload);
  }

  async updateIdentity(payload: { username: string; email: string; phone: string; password: string }): Promise<void> {
    await this.api.post<unknown>('mobile/account/identity', payload);
  }

  async updateWork(payload: { work_title: string; work_place: string; work_url: string }): Promise<void> {
    await this.api.post<unknown>('mobile/account/work', payload);
  }

  async updateLocation(payload: { city: string; hometown: string }): Promise<void> {
    await this.api.post<unknown>('mobile/account/location', payload);
  }

  async updateEducation(payload: { edu_major: string; edu_school: string; edu_class: string }): Promise<void> {
    await this.api.post<unknown>('mobile/account/education', payload);
  }

  async updateSocial(payload: {
    facebook: string;
    twitter: string;
    youtube: string;
    instagram: string;
    twitch: string;
    linkedin: string;
    vkontakte: string;
  }): Promise<void> {
    await this.api.post<unknown>('mobile/account/social', payload);
  }

  async updatePassword(payload: { current: string; new: string; confirm: string }): Promise<void> {
    await this.api.post<unknown>('mobile/account/password', payload);
  }

  async updatePrivacy(payload: Record<string, string | boolean>): Promise<void> {
    await this.api.post<unknown>('mobile/account/privacy', payload);
  }

  async updateOneSignalId(oneSignalId: string): Promise<void> {
    await this.api.post<unknown>('user/onesignal', { onesignal_id: oneSignalId });
  }
}

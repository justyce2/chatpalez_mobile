import { ApiError, type ApiPage, type ChatPalezApiClient } from './client';

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
  email_verified?: boolean;
  phone_verified?: boolean;
  privacy?: Record<string, string | boolean>;
};

export type ProfileUpdate = Partial<Pick<MobileAccount,
  'firstname' | 'lastname' | 'gender' | 'country' | 'relationship' |
  'birth_month' | 'birth_day' | 'birth_year' | 'biography' | 'website'>>;

export class UserService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async getProfile(): Promise<UserProfile> {
    return this.api.get<UserProfile>('user/profile');
  }

  async getAccount(): Promise<MobileAccount> {
    try {
      return await this.api.get<MobileAccount>('mobile/account');
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;

      // Some deployed backends may not yet expose the richer mobile/account
      // adapter. Fall back to the platform's built-in app/settings payload so
      // Account & Settings can still open without rendering a 404 as content.
      const settings = await this.api.get<Record<string, unknown>>('app/settings');
      const raw = ((settings.user ?? settings) as Record<string, unknown>);
      return normalizeAccount(raw);
    }
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


function normalizeAccount(raw: Record<string, unknown>): MobileAccount {
  const text = (key: string, fallback = ''): string => {
    const value = raw[key];
    return value === null || value === undefined ? fallback : String(value);
  };
  const nullableNumber = (key: string): number | null => {
    const value = Number(raw[key]);
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  return {
    user_id: (raw.user_id as number | string | undefined) ?? '',
    username: text('user_name', text('username')),
    email: text('user_email', text('email')),
    phone: text('user_phone', text('phone')),
    firstname: text('user_firstname', text('firstname')),
    lastname: text('user_lastname', text('lastname')),
    fullname: text('user_fullname', text('fullname')),
    picture: text('user_picture', text('picture')),
    biography: text('user_biography', text('biography')),
    website: text('user_website', text('website')),
    gender: (raw.user_gender ?? raw.gender ?? null) as number | string | null,
    country: (raw.user_country ?? raw.country ?? null) as number | string | null,
    relationship: (raw.user_relationship ?? raw.relationship ?? null) as string | null,
    birth_month: nullableNumber('birth_month'),
    birth_day: nullableNumber('birth_day'),
    birth_year: nullableNumber('birth_year'),
    work_title: text('user_work_title', text('work_title')),
    work_place: text('user_work_place', text('work_place')),
    work_url: text('user_work_url', text('work_url')),
    city: text('user_current_city', text('city')),
    hometown: text('user_hometown', text('hometown')),
    edu_major: text('user_edu_major', text('edu_major')),
    edu_school: text('user_edu_school', text('edu_school')),
    edu_class: text('user_edu_class', text('edu_class')),
    facebook: text('user_social_facebook', text('facebook')),
    twitter: text('user_social_twitter', text('twitter')),
    youtube: text('user_social_youtube', text('youtube')),
    instagram: text('user_social_instagram', text('instagram')),
    twitch: text('user_social_twitch', text('twitch')),
    linkedin: text('user_social_linkedin', text('linkedin')),
    vkontakte: text('user_social_vkontakte', text('vkontakte')),
    username_changes_disabled: Boolean(raw.username_changes_disabled ?? raw.disable_username_changes),
    email_verified: Boolean(raw.email_verified ?? raw.user_email_verified),
    phone_verified: Boolean(raw.phone_verified ?? raw.user_phone_verified),
    privacy: (raw.privacy && typeof raw.privacy === 'object' ? raw.privacy : undefined) as Record<string, string | boolean> | undefined
  };
}

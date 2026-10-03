import { deviceInfo } from './device-info';
import type { ChatPalezApiClient } from './client';
import type { AuthSession, ChatPalezUser } from '../auth/session';

export type RegistrationMetadata = {
  system: Record<string, unknown>;
  genders: Array<Record<string, unknown>>;
  countries: Array<Record<string, unknown>>;
  customFields: Array<Record<string, unknown>>;
  userGroups: Array<Record<string, unknown>>;
};

export type SignUpInput = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirm: string;
  gender?: string;
  birthdate?: string;
  invitationCode?: string;
  phone?: string;
  userGroup?: string;
  customFields?: Record<string, string | string[]>;
};

export type GettingStartedInput = {
  country: string;
  workTitle?: string;
  workPlace?: string;
  workUrl?: string;
  city?: string;
  hometown?: string;
  educationMajor?: string;
  educationSchool?: string;
  educationClass?: string;
};

type AppSettingsResponse = {
  system?: Record<string, unknown>;
  user?: ChatPalezUser;
};

type SignUpResponse = {
  token?: string;
  user?: ChatPalezUser;
};

export class RegistrationService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async getMetadata(): Promise<RegistrationMetadata> {
    const [settings, genders, countries, customFields, userGroups] = await Promise.all([
      this.api.get<AppSettingsResponse>('app/settings'),
      this.api.get<Array<Record<string, unknown>>>('app/genders'),
      this.api.get<Array<Record<string, unknown>>>('app/countries'),
      this.api.get<Array<Record<string, unknown>>>('app/custom_fields'),
      this.api.get<Array<Record<string, unknown>>>('app/user_groups')
    ]);

    return {
      system: settings?.system ?? {},
      genders: Array.isArray(genders) ? genders : [],
      countries: Array.isArray(countries) ? countries : [],
      customFields: Array.isArray(customFields) ? customFields : [],
      userGroups: Array.isArray(userGroups) ? userGroups : []
    };
  }

  async signUp(input: SignUpInput): Promise<AuthSession> {
    const payload: Record<string, unknown> = {
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      username: input.username.trim(),
      email: input.email.trim(),
      password: input.password,
      confirm: input.confirm,
      ...deviceInfo()
    };

    if (input.gender) payload.gender = input.gender;
    if (input.invitationCode) payload.invitation_code = input.invitationCode.trim();
    if (input.phone) payload.phone = input.phone.trim();
    if (input.userGroup) payload.custom_user_group = input.userGroup;
    if (input.birthdate) {
      const [year, month, day] = input.birthdate.split('-');
      payload.birth_year = year;
      payload.birth_month = month;
      payload.birth_day = day;
    }
    if (input.customFields) {
      for (const [key, value] of Object.entries(input.customFields)) {
        payload[key] = value;
      }
    }

    const data = await this.api.post<SignUpResponse>('auth/signup', payload);
    if (!data?.token || !data?.user) {
      throw new Error('ChatPalez created the account but did not return a valid mobile session.');
    }

    return { token: data.token, user: data.user };
  }

  async activate(code: string): Promise<void> {
    await this.api.post<unknown>('auth/activation', { code: code.trim() });
  }

  async resendActivation(): Promise<void> {
    await this.api.post<unknown>('auth/activation_resend', {});
  }

  async resetActivationIdentity(value: string, type: 'email' | 'phone' = 'email'): Promise<void> {
    await this.api.post<unknown>('auth/activation_reset', {
      [type]: value.trim()
    });
  }

  async updateGettingStarted(input: GettingStartedInput): Promise<void> {
    await this.api.post<unknown>('auth/getting_started_update', {
      country: input.country,
      work_title: input.workTitle?.trim() ?? '',
      work_place: input.workPlace?.trim() ?? '',
      work_url: input.workUrl?.trim() ?? '',
      city: input.city?.trim() ?? '',
      hometown: input.hometown?.trim() ?? '',
      edu_major: input.educationMajor?.trim() ?? '',
      edu_school: input.educationSchool?.trim() ?? '',
      edu_class: input.educationClass?.trim() ?? ''
    });
  }

  async finishGettingStarted(): Promise<void> {
    await this.api.post<unknown>('auth/getting_started_finish', {});
  }
}

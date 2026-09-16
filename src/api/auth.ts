import { Capacitor } from '@capacitor/core';
import type { ChatPalezApiClient } from './client';
import type { AuthSession, ChatPalezUser } from '../auth/session';

export type SignInInput = {
  usernameEmail: string;
  password: string;
};

export type TwoFactorChallenge = {
  requiresTwoFactor: true;
  userId: number | string;
  method: string;
};

export type SignInResult = AuthSession | TwoFactorChallenge;

type SignInResponse = {
  token?: string;
  user?: ChatPalezUser;
  '2FA'?: boolean;
  user_id?: number | string;
  method?: string;
};

export class AuthService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async signIn(input: SignInInput): Promise<SignInResult> {
    const data = await this.api.post<SignInResponse>('auth/signin', {
      username_email: input.usernameEmail.trim(),
      password: input.password,
      ...deviceInfo()
    });

    if (data?.['2FA'] && data.user_id !== undefined) {
      return {
        requiresTwoFactor: true,
        userId: data.user_id,
        method: String(data.method || 'your authentication method')
      };
    }

    if (!data?.token || !data?.user) {
      throw new Error('ChatPalez did not return a valid mobile session.');
    }

    return {
      token: data.token,
      user: data.user
    };
  }

  async completeTwoFactor(userId: number | string, key: string): Promise<AuthSession> {
    const data = await this.api.post<SignInResponse>('auth/two_factor_authentication', {
      user_id: userId,
      two_factor_key: key.trim(),
      ...deviceInfo()
    });

    if (!data?.token || !data?.user) {
      throw new Error('ChatPalez did not complete two-factor authentication.');
    }

    return {
      token: data.token,
      user: data.user
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.api.post<unknown>('auth/forget_password', {
      email: email.trim()
    });
  }

  async confirmPasswordResetCode(email: string, resetKey: string): Promise<void> {
    await this.api.post<unknown>('auth/forget_password_confirm', {
      email: email.trim(),
      reset_key: resetKey.trim()
    });
  }

  async resetPassword(email: string, resetKey: string, password: string, confirm: string): Promise<void> {
    await this.api.post<unknown>('auth/forget_password_reset', {
      email: email.trim(),
      reset_key: resetKey.trim(),
      password,
      confirm
    });
  }

  async signOut(): Promise<void> {
    await this.api.post<unknown>('auth/signout', {});
  }
}

function deviceInfo(): Record<string, string> {
  const platform = Capacitor.getPlatform();
  return {
    device_type: platform === 'android' ? 'A' : 'I',
    device_os_version: navigator.userAgent,
    device_name: `${platform || 'web'} ChatPalez`
  };
}

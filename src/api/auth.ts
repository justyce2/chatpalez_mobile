import { Capacitor } from '@capacitor/core';
import type { ChatPalezApiClient } from './client';
import type { AuthSession, ChatPalezUser } from '../auth/session';

export type SignInInput = {
  usernameEmail: string;
  password: string;
};

type SignInResponse = {
  token: string;
  user: ChatPalezUser;
};

export class AuthService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async signIn(input: SignInInput): Promise<AuthSession> {
    const platform = Capacitor.getPlatform();
    const data = await this.api.post<SignInResponse>('auth/signin', {
      username_email: input.usernameEmail.trim(),
      password: input.password,
      device_type: platform === 'android' ? 'A' : 'I',
      device_os_version: navigator.userAgent,
      device_name: `${platform || 'web'} ChatPalez`
    });

    if (!data?.token || !data?.user) {
      throw new Error('ChatPalez did not return a valid mobile session.');
    }

    return data;
  }

  async signOut(): Promise<void> {
    await this.api.post<unknown>('auth/signout', {});
  }
}

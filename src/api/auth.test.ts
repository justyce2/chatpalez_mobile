import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth';
import type { ChatPalezApiClient } from './client';

describe('AuthService password recovery', () => {
  it('requests a reset for a normalized email address', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const api = { post } as unknown as ChatPalezApiClient;
    const auth = new AuthService(api);

    await auth.requestPasswordReset('  user@example.com  ');

    expect(post).toHaveBeenCalledWith('auth/forget_password', {
      email: 'user@example.com'
    });
  });

  it('confirms the reset code before password replacement', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const api = { post } as unknown as ChatPalezApiClient;
    const auth = new AuthService(api);

    await auth.confirmPasswordResetCode('user@example.com', ' 123456 ');

    expect(post).toHaveBeenCalledWith('auth/forget_password_confirm', {
      email: 'user@example.com',
      reset_key: '123456'
    });
  });

  it('submits new password and confirmation to the official reset route', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const api = { post } as unknown as ChatPalezApiClient;
    const auth = new AuthService(api);

    await auth.resetPassword('user@example.com', '123456', 'new-password', 'new-password');

    expect(post).toHaveBeenCalledWith('auth/forget_password_reset', {
      email: 'user@example.com',
      reset_key: '123456',
      password: 'new-password',
      confirm: 'new-password'
    });
  });
});

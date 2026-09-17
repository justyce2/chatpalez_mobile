import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth';
import type { ChatPalezApiClient } from './client';

describe('AuthService', () => {
  it('uses the official sign-in, two-factor, and sign-out routes', async () => {
    const post = vi.fn()
      .mockResolvedValueOnce({ token: 'session-token', user: { user_id: 7 } })
      .mockResolvedValueOnce({ token: 'two-factor-token', user: { user_id: 7 } })
      .mockResolvedValueOnce(undefined);
    const api = { post } as unknown as ChatPalezApiClient;
    const auth = new AuthService(api);

    await expect(auth.signIn({ usernameEmail: '  justice  ', password: 'secret' })).resolves.toMatchObject({ token: 'session-token' });
    await expect(auth.completeTwoFactor(7, ' 123456 ')).resolves.toMatchObject({ token: 'two-factor-token' });
    await auth.signOut();

    expect(post).toHaveBeenNthCalledWith(1, 'auth/signin', expect.objectContaining({ username_email: 'justice', password: 'secret' }));
    expect(post).toHaveBeenNthCalledWith(2, 'auth/two_factor_authentication', expect.objectContaining({ user_id: 7, two_factor_key: '123456' }));
    expect(post).toHaveBeenNthCalledWith(3, 'auth/signout', {});
  });

  it('returns a two-factor challenge instead of treating it as a session', async () => {
    const post = vi.fn().mockResolvedValue({ '2FA': true, user_id: 7, method: 'email' });
    const api = { post } as unknown as ChatPalezApiClient;

    await expect(new AuthService(api).signIn({ usernameEmail: 'justice', password: 'secret' }))
      .resolves.toEqual({ requiresTwoFactor: true, userId: 7, method: 'email' });
  });

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

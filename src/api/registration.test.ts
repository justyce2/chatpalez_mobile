import { describe, expect, it, vi } from 'vitest';
import { RegistrationService } from './registration';
import type { ChatPalezApiClient } from './client';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android'
  }
}));

describe('RegistrationService', () => {
  it('loads signup metadata from the official app endpoints', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ system: { registration_enabled: true } })
      .mockResolvedValueOnce([{ gender_id: '1', gender_name: 'Male' }])
      .mockResolvedValueOnce([{ country_id: '160', country_name: 'Nigeria' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const api = { get } as unknown as ChatPalezApiClient;
    const service = new RegistrationService(api);

    const metadata = await service.getMetadata();

    expect(get).toHaveBeenNthCalledWith(1, 'app/settings');
    expect(get).toHaveBeenNthCalledWith(2, 'app/genders');
    expect(get).toHaveBeenNthCalledWith(3, 'app/countries');
    expect(get).toHaveBeenNthCalledWith(4, 'app/custom_fields');
    expect(get).toHaveBeenNthCalledWith(5, 'app/user_groups');
    expect(metadata.countries).toHaveLength(1);
  });

  it('submits the normalized signup contract and returns a session', async () => {
    const post = vi.fn().mockResolvedValue({
      token: 'jwt-token',
      user: { user_id: 7, user_name: 'justice' }
    });
    const api = { post } as unknown as ChatPalezApiClient;
    const service = new RegistrationService(api);

    const session = await service.signUp({
      firstName: ' Justice ',
      lastName: ' Clement ',
      username: ' justice ',
      email: ' justice@example.com ',
      password: 'secret123',
      confirm: 'secret123',
      gender: '1'
    });

    expect(post).toHaveBeenCalledWith('auth/signup', expect.objectContaining({
      firstname: 'Justice',
      lastname: 'Clement',
      username: 'justice',
      email: 'justice@example.com',
      password: 'secret123',
      confirm: 'secret123',
      gender: '1',
      device_type: 'A'
    }));
    expect(session.token).toBe('jwt-token');
    expect(session.user.user_id).toBe(7);
  });

  it('uses the official activation and getting-started routes', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const api = { post } as unknown as ChatPalezApiClient;
    const service = new RegistrationService(api);

    await service.activate(' 123456 ');
    await service.resendActivation();
    await service.resetActivationIdentity(' justice@example.com ');
    await service.updateGettingStarted({ country: '160', city: 'Abuja' });
    await service.finishGettingStarted();

    expect(post).toHaveBeenNthCalledWith(1, 'auth/activation', { code: '123456' });
    expect(post).toHaveBeenNthCalledWith(2, 'auth/activation_resend', {});
    expect(post).toHaveBeenNthCalledWith(3, 'auth/activation_reset', { email: 'justice@example.com' });
    expect(post).toHaveBeenNthCalledWith(4, 'auth/getting_started_update', expect.objectContaining({
      country: '160',
      city: 'Abuja'
    }));
    expect(post).toHaveBeenNthCalledWith(5, 'auth/getting_started_finish', {});
  });
});

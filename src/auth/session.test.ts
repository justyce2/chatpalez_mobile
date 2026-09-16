import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, getAuthToken, getSession, restoreSession, setSession } from './session';

describe('mobile auth session', () => {
  beforeEach(async () => {
    await clearSession();
  });

  it('keeps the JWT available in memory for the active app run', async () => {
    await setSession({
      token: 'test-token',
      user: { user_id: 42, user_name: 'tester' }
    });

    expect(getAuthToken()).toBe('test-token');
    expect(getSession()?.user.user_id).toBe(42);
  });

  it('clears the active session on logout', async () => {
    await setSession({
      token: 'test-token',
      user: { user_id: 42 }
    });

    await clearSession();

    expect(getAuthToken()).toBeNull();
    expect(getSession()).toBeNull();
  });

  it('does not require browser storage to restore a browser session', async () => {
    expect(await restoreSession()).toBeNull();
  });
});

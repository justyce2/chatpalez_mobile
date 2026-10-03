import { describe, expect, it } from 'vitest';
import { normalizeNotificationRoute } from './route';

const origin = new URL('https://chatpalez.com');

describe('notification route normalization', () => {
  it('accepts an internal relative route', () => {
    expect(normalizeNotificationRoute(origin, '/messages?thread=8#latest')).toBe('/messages?thread=8#latest');
  });

  it('accepts the configured same-origin absolute URL', () => {
    expect(normalizeNotificationRoute(origin, 'https://chatpalez.com/profile/tester')).toBe('/profile/tester');
  });

  it('rejects external and malformed routes', () => {
    expect(normalizeNotificationRoute(origin, 'https://attacker.example/steal')).toBeNull();
    expect(normalizeNotificationRoute(origin, 'https://chatpalez.com:444/profile')).toBeNull();
    expect(normalizeNotificationRoute(origin, undefined)).toBeNull();
  });
});

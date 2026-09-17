import { describe, expect, it } from 'vitest';
import { createWebSessionTransition, normalizeInternalPath } from './web-session';

describe('normalizeInternalPath', () => {
  it('keeps the bridge token and destination out of the action URL', () => {
    const transition = createWebSessionTransition({
      config: { origin: new URL('https://chatpalez.com'), allowedHosts: new Set(['chatpalez.com']) },
      token: 'jwt-value',
      path: '/groups?tab=joined'
    });

    expect(transition.action).toBe('https://chatpalez.com/mobile-session.php');
    expect(transition.action).not.toContain('jwt-value');
    expect(transition.action).not.toContain('groups');
    expect(transition.path).toBe('/groups?tab=joined');
  });

  it('rejects an empty bridge token', () => {
    expect(() => createWebSessionTransition({
      config: { origin: new URL('https://chatpalez.com'), allowedHosts: new Set(['chatpalez.com']) },
      token: '   ',
      path: '/'
    })).toThrow(/session is unavailable/i);
  });

  it('keeps an internal ChatPalez path relative to the trusted origin', () => {
    expect(normalizeInternalPath('https://chatpalez.com', '/messages?tab=all#latest')).toBe('/messages?tab=all#latest');
  });

  it('normalizes relative paths onto the trusted origin', () => {
    expect(normalizeInternalPath('https://chatpalez.com', 'settings/privacy')).toBe('/settings/privacy');
  });

  it('rejects external destinations', () => {
    expect(() => normalizeInternalPath('https://chatpalez.com', 'https://example.com/steal')).toThrow(/untrusted/i);
  });

  it('rejects protocol-relative external destinations', () => {
    expect(() => normalizeInternalPath('https://chatpalez.com', '//example.com/steal')).toThrow(/untrusted/i);
  });
});

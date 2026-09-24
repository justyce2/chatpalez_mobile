import { describe, expect, it } from 'vitest';
import type { AppConfig } from './config';
import { normalizeInternalRoute, resolveAppDeepLink } from './navigation';

const config: AppConfig = {
  origin: new URL('https://chatpalez.com'),
  chatSocketUrl: new URL('https://chatpalez.com'),
  allowedHosts: new Set(['chatpalez.com'])
};

describe('normalizeInternalRoute', () => {
  it('normalizes same-origin absolute and relative routes', () => {
    expect(normalizeInternalRoute('https://chatpalez.com/messages?thread=7#latest', config)).toBe('/messages?thread=7#latest');
    expect(normalizeInternalRoute('/settings/notifications', config)).toBe('/settings/notifications');
  });

  it('rejects untrusted origins and non-HTTPS ChatPalez URLs', () => {
    expect(normalizeInternalRoute('https://example.org/messages', config)).toBeNull();
    expect(normalizeInternalRoute('http://chatpalez.com/messages', config)).toBeNull();
  });
});

describe('resolveAppDeepLink', () => {
  it('accepts trusted HTTPS ChatPalez URLs', () => {
    expect(resolveAppDeepLink('https://chatpalez.com/profile/justice', config)).toBe('/profile/justice');
  });

  it('maps the registered custom scheme to a trusted internal path', () => {
    expect(resolveAppDeepLink('chatpalez://open?path=%2Fsettings%2Fnotifications', config)).toBe('/settings/notifications');
  });

  it('accepts a same-origin encoded HTTPS target', () => {
    const target = encodeURIComponent('https://chatpalez.com/messages?thread=10');
    expect(resolveAppDeepLink(`chatpalez://open?url=${target}`, config)).toBe('/messages?thread=10');
  });

  it('rejects custom-scheme attempts to escape to another origin', () => {
    const external = encodeURIComponent('https://example.org/phish');
    expect(resolveAppDeepLink(`chatpalez://open?url=${external}`, config)).toBeNull();
  });

  it('rejects protocol-relative targets and unknown custom hosts', () => {
    expect(resolveAppDeepLink('chatpalez://open?path=%2F%2Fevil.example%2Ffoo', config)).toBeNull();
    expect(resolveAppDeepLink('chatpalez://evil?path=%2Fmessages', config)).toBeNull();
  });

  it('rejects script/data schemes', () => {
    expect(resolveAppDeepLink('javascript:alert(1)', config)).toBeNull();
    expect(resolveAppDeepLink('data:text/html,test', config)).toBeNull();
  });
});

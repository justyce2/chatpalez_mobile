import { describe, expect, it } from 'vitest';
import { normalizeInternalPath } from './web-session';

describe('normalizeInternalPath', () => {
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

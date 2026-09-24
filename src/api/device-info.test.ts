import { describe, expect, it } from 'vitest';
import { osVersionFromUserAgent } from './device-info';

describe('mobile OS version', () => {
  it('extracts a short Android version from a long WebView user agent', () => {
    expect(osVersionFromUserAgent('android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')).toBe('14');
  });

  it('extracts an iOS version', () => {
    expect(osVersionFromUserAgent('ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)')).toBe('18.1');
  });

  it('uses a short fallback when no version is exposed', () => {
    expect(osVersionFromUserAgent('android', 'Mozilla/5.0')).toBe('Unknown');
  });
});

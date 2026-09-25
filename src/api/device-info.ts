import { Capacitor } from '@capacitor/core';

export function deviceInfo(): Record<string, string> {
  const platform = Capacitor.getPlatform();
  return {
    device_type: platform === 'android' ? 'A' : 'I',
    device_os_version: osVersionFromUserAgent(platform, navigator.userAgent),
    device_name: `${platform || 'web'} ChatPalez`
  };
}

export function osVersionFromUserAgent(platform: string, userAgent: string): string {
  const pattern = platform === 'android'
    ? /\bAndroid\s+([0-9]+(?:\.[0-9]+)*)/i
    : /\bOS\s+([0-9]+(?:[_\.][0-9]+)*)\b/i;
  return pattern.exec(userAgent)?.[1].replace(/_/g, '.').slice(0, 16) || 'Unknown';
}

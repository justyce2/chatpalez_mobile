import type { AppConfig } from './config';

export function validateTrustedHttpsUrl(rawUrl: string, config: AppConfig): URL | null {
  try {
    const url = new URL(rawUrl, config.origin);
    if (url.protocol !== 'https:') return null;
    if (!config.allowedHosts.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

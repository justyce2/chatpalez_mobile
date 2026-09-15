import { Browser } from '@capacitor/browser';
import type { AppConfig } from './config';

const SAFE_EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const APP_DEEP_LINK_SCHEME = 'chatpalez:';
const APP_DEEP_LINK_HOST = 'open';

export function isTrustedInternalUrl(rawUrl: string, config: AppConfig): boolean {
  try {
    const url = new URL(rawUrl, config.origin);
    return url.protocol === 'https:' && config.allowedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function openExternalUrl(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!SAFE_EXTERNAL_SCHEMES.has(url.protocol)) return false;

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    await Browser.open({ url: url.toString() });
    return true;
  }

  window.location.href = url.toString();
  return true;
}

export function normalizeInternalRoute(rawUrl: string, config: AppConfig): string | null {
  try {
    const url = new URL(rawUrl, config.origin);
    if (!isTrustedInternalUrl(url.toString(), config)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function resolveAppDeepLink(rawUrl: string, config: AppConfig): string | null {
  const directRoute = normalizeInternalRoute(rawUrl, config);
  if (directRoute) return directRoute;

  try {
    const deepLink = new URL(rawUrl);
    if (deepLink.protocol !== APP_DEEP_LINK_SCHEME || deepLink.hostname !== APP_DEEP_LINK_HOST) {
      return null;
    }

    const requestedTarget = deepLink.searchParams.get('url') ?? deepLink.searchParams.get('path') ?? '/';
    if (requestedTarget.startsWith('//')) return null;

    return normalizeInternalRoute(requestedTarget, config);
  } catch {
    return null;
  }
}

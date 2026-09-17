import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import type { AppConfig } from './config';
import { isTrustedInternalUrl, openExternalUrl } from './navigation';

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

export interface ChatPalezMobileBridge {
  readonly bridgeVersion: '1.0';
  isNativeApp(): boolean;
  platform(): string;
  share(payload: SharePayload): Promise<boolean>;
  openExternal(url: string): Promise<boolean>;
  notifyRouteChanged(url: string): boolean;
}

declare global {
  interface Window {
    ChatPalezMobile?: ChatPalezMobileBridge;
  }
}

export function installMobileBridge(config: AppConfig): ChatPalezMobileBridge {
  const bridge: ChatPalezMobileBridge = {
    bridgeVersion: '1.0',
    isNativeApp: () => Capacitor.isNativePlatform(),
    platform: () => Capacitor.getPlatform(),
    async share(payload) {
      try {
        await Share.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          dialogTitle: payload.title ?? 'Share from ChatPalez'
        });
        return true;
      } catch {
        return false;
      }
    },
    openExternal: openExternalUrl,
    notifyRouteChanged(url) {
      if (!isTrustedInternalUrl(url, config)) return false;
      window.dispatchEvent(new CustomEvent('chatpalez:route-changed', { detail: { url } }));
      return true;
    }
  };

  window.ChatPalezMobile = bridge;
  window.dispatchEvent(new CustomEvent('chatpalez:bridge-ready', { detail: { version: bridge.bridgeVersion } }));
  return bridge;
}

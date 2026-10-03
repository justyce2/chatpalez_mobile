import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import type { AppConfig } from './config';
import { isTrustedInternalUrl, openExternalUrl } from './navigation';

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

export type MediaPickerSource = 'photos' | 'camera';

export interface PickedMedia {
  dataUrl: string;
  mimeType: string;
  name: string;
}

export interface MediaPickerPayload {
  source: MediaPickerSource;
  multiple?: boolean;
}

export interface ChatPalezMobileBridge {
  readonly bridgeVersion: '1.0';
  isNativeApp(): boolean;
  platform(): string;
  share(payload: SharePayload): Promise<boolean>;
  pickMedia(payload: MediaPickerPayload): Promise<PickedMedia[]>;
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
    async pickMedia(payload) {
      if (!Capacitor.isNativePlatform()) return [];
      try {
        if (payload.source === 'photos' && payload.multiple) {
          const selection = await Camera.pickImages({ quality: 90, limit: 10 });
          const picked: PickedMedia[] = [];
          for (let index = 0; index < selection.photos.length; index += 1) {
            const photo = selection.photos[index];
            const response = await fetch(photo.webPath);
            const blob = await response.blob();
            const dataUrl = await blobToDataUrl(blob);
            picked.push({
              dataUrl,
              mimeType: blob.type || 'image/jpeg',
              name: `chatpalez-photo-${Date.now()}-${index + 1}.${extensionForMime(blob.type)}`
            });
          }
          return picked;
        }

        const photo = await Camera.getPhoto({
          source: payload.source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
          resultType: CameraResultType.Uri,
          quality: 90,
          allowEditing: false,
          saveToGallery: false
        });
        if (!photo.webPath) return [];
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        return [{
          dataUrl: await blobToDataUrl(blob),
          mimeType: blob.type || 'image/jpeg',
          name: `chatpalez-photo-${Date.now()}.${extensionForMime(blob.type)}`
        }];
      } catch {
        return [];
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


function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'heic';
  return 'jpg';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read selected media.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

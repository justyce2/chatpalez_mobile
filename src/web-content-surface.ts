import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AppConfig } from './config';
import { createWebSessionTransition } from './web-session';

export type WebContentFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type OpenOptions = WebContentFrame & {
  action: string;
  token: string;
  path: string;
  allowedOrigin: string;
};

interface WebContentSurfaceNativePlugin {
  open(options: OpenOptions): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  setFrame(options: WebContentFrame): Promise<void>;
  canGoBack(): Promise<{ value: boolean }>;
  goBack(): Promise<void>;
  reload(): Promise<void>;
  addListener(eventName: 'routeChanged', listener: (event: { url: string }) => void): Promise<{ remove: () => Promise<void> }>;
}

const NativeSurface = registerPlugin<WebContentSurfaceNativePlugin>('WebContentSurface');

function currentFrame(): WebContentFrame {
  const topbar = document.querySelector<HTMLElement>('.mobile-topbar');
  const bottomTabs = document.querySelector<HTMLElement>('.bottom-tabs');
  if (!topbar || !bottomTabs) {
    throw new Error('ChatPalez web-content bounds are unavailable.');
  }

  const top = Math.max(0, topbar.getBoundingClientRect().bottom);
  const bottom = Math.min(window.innerHeight, bottomTabs.getBoundingClientRect().top);
  return {
    x: 0,
    y: top,
    width: window.innerWidth,
    height: Math.max(0, bottom - top)
  };
}

export class WebContentSurface {
  private visible = false;

  isSupported(): boolean {
    return Capacitor.isNativePlatform();
  }

  async openAuthenticated(config: AppConfig, token: string, path: string): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Native web-content surface is unavailable outside the installed app.');
    }

    const transition = createWebSessionTransition({ config, token, path });
    const frame = currentFrame();
    await NativeSurface.open({
      ...frame,
      action: transition.action,
      token: transition.token,
      path: transition.path,
      allowedOrigin: config.origin.origin
    });
    this.visible = true;
  }

  async show(): Promise<void> {
    if (!this.isSupported()) return;
    await NativeSurface.setFrame(currentFrame());
    await NativeSurface.show();
    this.visible = true;
  }

  async hide(): Promise<void> {
    if (!this.isSupported()) return;
    await NativeSurface.hide();
    this.visible = false;
  }

  async syncFrame(): Promise<void> {
    if (!this.isSupported() || !this.visible) return;
    await NativeSurface.setFrame(currentFrame());
  }

  async canGoBack(): Promise<boolean> {
    if (!this.isSupported() || !this.visible) return false;
    return (await NativeSurface.canGoBack()).value;
  }

  async goBack(): Promise<void> {
    if (!this.isSupported() || !this.visible) return;
    await NativeSurface.goBack();
  }

  async reload(): Promise<void> {
    if (!this.isSupported() || !this.visible) return;
    await NativeSurface.reload();
  }

  async onRouteChanged(listener: (url: string) => void): Promise<() => Promise<void>> {
    if (!this.isSupported()) return async () => undefined;
    const handle = await NativeSurface.addListener('routeChanged', ({ url }) => listener(url));
    return () => handle.remove();
  }

}

export const webContentSurface = new WebContentSurface();

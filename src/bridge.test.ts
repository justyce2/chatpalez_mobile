import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from './config';

const { share } = vi.hoisted(() => ({ share: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android'
  }
}));

vi.mock('@capacitor/share', () => ({
  Share: { share }
}));

vi.mock('@capacitor/camera', () => ({
  Camera: {
    pickImages: vi.fn().mockResolvedValue({ photos: [] }),
    getPhoto: vi.fn()
  },
  CameraResultType: { Uri: 'uri' },
  CameraSource: { Camera: 'CAMERA', Photos: 'PHOTOS' }
}));

import { installMobileBridge } from './bridge';
import { bindWebBridgeEvents } from './web-bridge-events';

const config: AppConfig = {
  origin: new URL('https://chatpalez.com'),
  allowedHosts: new Set(['chatpalez.com'])
};

beforeEach(() => {
  share.mockClear();
  const target = new EventTarget();
  Object.assign(globalThis, {
    window: Object.assign(target, {
      location: { href: '' }
    })
  });
});

describe('hybrid web bridge', () => {
  it('publishes only trusted route notifications', () => {
    const bridge = installMobileBridge(config);
    const routes: string[] = [];
    window.addEventListener('chatpalez:route-changed', (event) => {
      routes.push((event as CustomEvent<{ url: string }>).detail.url);
    });

    expect(bridge.isNativeApp()).toBe(true);
    expect(bridge.platform()).toBe('android');
    expect(typeof bridge.pickMedia).toBe('function');
    expect(bridge.notifyRouteChanged('https://chatpalez.com/messages')).toBe(true);
    expect(bridge.notifyRouteChanged('https://example.com/messages')).toBe(false);
    expect(routes).toEqual(['https://chatpalez.com/messages']);
  });

  it('binds web share events to the native bridge', async () => {
    const bridge = installMobileBridge(config);
    bindWebBridgeEvents(bridge);

    window.dispatchEvent(new CustomEvent('chatpalez:share', {
      detail: { title: 'ChatPalez', url: 'https://chatpalez.com/posts/1' }
    }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: 'ChatPalez',
      url: 'https://chatpalez.com/posts/1'
    }));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from './config';

const state = vi.hoisted(() => ({
  native: true,
  platform: 'android',
  listeners: new Map<string, (event: any) => void>(),
  minimizeApp: vi.fn().mockResolvedValue(undefined),
  historyBack: vi.fn()
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => state.native,
    getPlatform: () => state.platform
  }
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (event: string, callback: (payload: any) => void) => {
      state.listeners.set(event, callback);
      return { remove: vi.fn() };
    }),
    minimizeApp: state.minimizeApp
  }
}));

import { registerNativeLifecycle } from './native-lifecycle';

const config: AppConfig = {
  origin: new URL('https://chatpalez.com'),
  chatSocketUrl: new URL('https://chatpalez.com'),
  allowedHosts: new Set(['chatpalez.com'])
};

beforeEach(() => {
  state.native = true;
  state.platform = 'android';
  state.listeners.clear();
  state.minimizeApp.mockClear();
  state.historyBack.mockClear();
  Object.assign(globalThis, {
    window: Object.assign(new EventTarget(), {
      history: { back: state.historyBack }
    })
  });
});

describe('native lifecycle', () => {
  it('does not install listeners for a browser build', async () => {
    state.native = false;
    await registerNativeLifecycle(config, vi.fn());
    expect(state.listeners.size).toBe(0);
  });

  it('routes only trusted app links and dispatches lifecycle events', async () => {
    const routes: string[] = [];
    const restored: unknown[] = [];
    const states: boolean[] = [];
    window.addEventListener('chatpalez:app-restored-result', (event) => restored.push((event as CustomEvent).detail));
    window.addEventListener('chatpalez:app-state', (event) => states.push((event as CustomEvent<{ isActive: boolean }>).detail.isActive));

    await registerNativeLifecycle(config, (route) => routes.push(route));
    state.listeners.get('appUrlOpen')!({ url: 'chatpalez://open?path=%2Fmessages%3Fthread%3D7' });
    state.listeners.get('appUrlOpen')!({ url: 'chatpalez://open?url=https%3A%2F%2Fevil.example%2Fsteal' });
    state.listeners.get('appRestoredResult')!({ pluginId: 'Camera', value: 'photo' });
    state.listeners.get('appStateChange')!({ isActive: false });

    expect(routes).toEqual(['/messages?thread=7']);
    expect(restored).toEqual([{ pluginId: 'Camera', value: 'photo' }]);
    expect(states).toEqual([false]);
  });

  it('uses Android history when possible and minimizes only at root', async () => {
    await registerNativeLifecycle(config, vi.fn());
    const backButton = state.listeners.get('backButton')!;
    backButton({ canGoBack: true });
    backButton({ canGoBack: false });
    await Promise.resolve();

    expect(state.historyBack).toHaveBeenCalledTimes(1);
    expect(state.minimizeApp).toHaveBeenCalledTimes(1);
  });

  it('does not register Android back handling on iOS', async () => {
    state.platform = 'ios';
    await registerNativeLifecycle(config, vi.fn());
    expect(state.listeners.has('backButton')).toBe(false);
  });
});

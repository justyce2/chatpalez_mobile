import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { AppConfig } from './config';
import { resolveAppDeepLink } from './navigation';

export type RouteHandler = (route: string) => void;
export type NativeScreen = 'messages' | 'notifications' | 'profile';
export type NativeScreenHandler = (screen: NativeScreen) => void;

function resolveNativeScreen(url: string): NativeScreen | null {
  try {
    const deepLink = new URL(url);
    if (deepLink.protocol !== 'chatpalez:' || deepLink.hostname !== 'open') return null;
    const screen = deepLink.searchParams.get('native');
    return screen === 'messages' || screen === 'notifications' || screen === 'profile' ? screen : null;
  } catch {
    return null;
  }
}

export async function registerNativeLifecycle(
  config: AppConfig,
  onRoute: RouteHandler,
  onNativeScreen?: NativeScreenHandler,
  onAppBack?: () => Promise<boolean>
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await App.addListener('appUrlOpen', ({ url }) => {
    const nativeScreen = resolveNativeScreen(url);
    if (nativeScreen && onNativeScreen) {
      onNativeScreen(nativeScreen);
      return;
    }

    const route = resolveAppDeepLink(url, config);
    if (route) onRoute(route);
  });

  if (Capacitor.getPlatform() === 'android') {
    await App.addListener('backButton', async ({ canGoBack }) => {
      if (onAppBack && await onAppBack()) {
        return;
      }

      // Auth, registration, recovery and public/legal screens live in the
      // primary Capacitor WebView rather than the authenticated shell stack.
      // Give their real browser history a chance before minimizing the app.
      if (canGoBack || window.history.length > 1) {
        window.history.back();
        return;
      }

      void App.minimizeApp();
    });
  }

  await App.addListener('appRestoredResult', (event) => {
    window.dispatchEvent(new CustomEvent('chatpalez:app-restored-result', { detail: event }));
  });

  await App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new CustomEvent('chatpalez:app-state', { detail: { isActive } }));
  });
}

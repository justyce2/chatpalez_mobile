import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { AppConfig } from './config';
import { resolveAppDeepLink } from './navigation';

export type RouteHandler = (route: string) => void;

export async function registerNativeLifecycle(config: AppConfig, onRoute: RouteHandler): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await App.addListener('appUrlOpen', ({ url }) => {
    const route = resolveAppDeepLink(url, config);
    if (route) onRoute(route);
  });

  if (Capacitor.getPlatform() === 'android') {
    await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
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

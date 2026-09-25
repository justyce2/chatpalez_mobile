import { Capacitor } from '@capacitor/core';
import OneSignal from '@onesignal/capacitor-plugin';
import type { AppConfig } from '../config';
import type { UserService } from '../api/user';
import { normalizeNotificationRoute } from './route';

export type NativeNotificationStatus =
  | 'unsupported'
  | 'not-configured'
  | 'disabled'
  | 'enabled';

let initialized = false;
let syncCurrentUser: (() => Promise<void>) | null = null;
let userListenerRegistered = false;
let notificationClickListenerRegistered = false;
let openNotificationRoute: ((path: string) => void) | null = null;

function isConfigured(config: AppConfig): boolean {
  return Capacitor.isNativePlatform() && Boolean(config.oneSignalAppId);
}

async function syncOneSignalUser(users: UserService): Promise<void> {
  const oneSignalId = await OneSignal.User.getOnesignalId();
  if (oneSignalId) {
    await users.updateOneSignalId(oneSignalId);
  }
}

export async function getNativeNotificationStatus(config: AppConfig): Promise<NativeNotificationStatus> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  if (!config.oneSignalAppId) return 'not-configured';
  if (!initialized) return 'disabled';
  return (await OneSignal.Notifications.hasPermission()) ? 'enabled' : 'disabled';
}

export async function initializeNativeNotifications(
  config: AppConfig,
  users: UserService,
  userId: number | string,
  onNotificationRoute?: (path: string) => void
): Promise<NativeNotificationStatus> {
  if (!isConfigured(config)) return getNativeNotificationStatus(config);

  syncCurrentUser = () => syncOneSignalUser(users);
  openNotificationRoute = onNotificationRoute ?? null;

  if (!initialized) {
    await OneSignal.initialize(config.oneSignalAppId!);
    initialized = true;
  }

  if (!notificationClickListenerRegistered) {
    OneSignal.Notifications.addEventListener('click', (event) => {
      const route = normalizeNotificationRoute(config.origin, event.result?.url);
      if (route) openNotificationRoute?.(route);
    });
    notificationClickListenerRegistered = true;
  }

  if (!userListenerRegistered) {
    OneSignal.User.addEventListener('change', () => {
      void syncCurrentUser?.().catch(() => undefined);
    });
    userListenerRegistered = true;
  }

  await OneSignal.login(String(userId));
  await syncOneSignalUser(users);
  return getNativeNotificationStatus(config);
}

export async function requestNativeNotificationPermission(
  config: AppConfig,
  users: UserService,
  userId: number | string,
  onNotificationRoute?: (path: string) => void
): Promise<NativeNotificationStatus> {
  const initialStatus = await initializeNativeNotifications(config, users, userId, onNotificationRoute);
  if (initialStatus === 'unsupported' || initialStatus === 'not-configured') return initialStatus;

  await OneSignal.Notifications.requestPermission(true);
  await syncOneSignalUser(users);
  return getNativeNotificationStatus(config);
}

export async function logoutNativeNotifications(): Promise<void> {
  syncCurrentUser = null;
  openNotificationRoute = null;
  if (!initialized || !Capacitor.isNativePlatform()) return;
  await OneSignal.logout();
}

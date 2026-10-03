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
let pushSubscriptionListenerRegistered = false;
let notificationClickListenerRegistered = false;
let openNotificationRoute: ((path: string) => void) | null = null;

function isConfigured(config: AppConfig): boolean {
  return Capacitor.isNativePlatform() && Boolean(config.oneSignalAppId);
}

async function syncOneSignalSubscriptionId(
  users: UserService,
  subscriptionId?: string | null
): Promise<boolean> {
  // OneSignal.login() associates the current device subscription with
  // ChatPalez's stable account ID. The existing backend /user/onesignal
  // endpoint expects the PUSH SUBSCRIPTION ID, not the OneSignal user ID.
  const id = subscriptionId ?? await OneSignal.User.pushSubscription.getIdAsync();
  if (!id) return false;


  await users.updateOneSignalSubscriptionId(id);
  return true;
}

async function waitForOneSignalSubscription(users: UserService): Promise<void> {
  // A subscription can be created asynchronously after initialize/login or
  // after the native permission prompt. getIdAsync() legitimately returns
  // null until OneSignal has assigned it, so give the SDK a short bounded
  // window instead of silently abandoning the synchronization.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await syncOneSignalSubscriptionId(users)) return;
    if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 300));
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

  syncCurrentUser = () => waitForOneSignalSubscription(users);
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

  if (!pushSubscriptionListenerRegistered) {
    OneSignal.User.pushSubscription.addEventListener('change', (event) => {
      void syncOneSignalSubscriptionId(users, event.current.id).catch(() => undefined);
    });
    pushSubscriptionListenerRegistered = true;
  }

  await OneSignal.login(String(userId));
  await waitForOneSignalSubscription(users);
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
  await waitForOneSignalSubscription(users);
  return getNativeNotificationStatus(config);
}

export async function logoutNativeNotifications(): Promise<void> {
  syncCurrentUser = null;
  openNotificationRoute = null;
  if (!initialized || !Capacitor.isNativePlatform()) return;
  await OneSignal.logout();
}

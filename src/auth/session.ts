import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

export type ChatPalezUser = {
  user_id: number | string;
  user_name?: string;
  user_firstname?: string;
  user_lastname?: string;
  user_fullname?: string;
  user_email?: string;
  user_picture?: string;
  [key: string]: unknown;
};

export type AuthSession = {
  token: string;
  user: ChatPalezUser;
};

const SESSION_KEY = 'mobile.session.v1';
let current: AuthSession | null = null;
let storageReady: Promise<void> | null = null;

/**
 * Restores a session only from the operating system's protected store.
 * Browser builds intentionally remain memory-only: the secure-storage plugin's
 * web fallback uses localStorage, which is not acceptable for JWT persistence.
 */
export async function restoreSession(): Promise<AuthSession | null> {
  if (!isNative()) return current;

  try {
    await prepareNativeStorage();
    const raw = await SecureStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const restored = parseSession(raw);
    if (!restored) {
      await SecureStorage.removeItem(SESSION_KEY);
      return null;
    }

    current = restored;
    return current;
  } catch {
    // A protected-store failure must never make us fall back to browser storage.
    return current;
  }
}

export function getSession(): AuthSession | null {
  return current;
}

export function getAuthToken(): string | null {
  return current?.token ?? null;
}

/**
 * Keeps an in-process session immediately and persists it only on Android/iOS.
 * Persistence errors do not cause an insecure fallback; they simply leave the
 * session available for the current app run.
 */
export async function setSession(session: AuthSession): Promise<void> {
  current = session;
  if (!isNative()) return;

  try {
    await prepareNativeStorage();
    await SecureStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Do not write a JWT to sessionStorage/localStorage as a fallback.
  }
}

export async function clearSession(): Promise<void> {
  current = null;
  if (!isNative()) return;

  try {
    await prepareNativeStorage();
    await SecureStorage.removeItem(SESSION_KEY);
  } catch {
    // Clearing the in-memory value is still required even if the native store
    // cannot be reached; a later restore may retry the removal.
  }
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

async function prepareNativeStorage(): Promise<void> {
  if (!storageReady) {
    storageReady = (async () => {
      await SecureStorage.setSynchronize(false);
      await SecureStorage.setKeyPrefix('chatpalez.');
      await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
    })();
  }
  return storageReady;
}

function parseSession(raw: string): AuthSession | null {
  try {
    const value = JSON.parse(raw) as Partial<AuthSession>;
    if (!value.token || typeof value.token !== 'string' || !value.user || typeof value.user !== 'object') {
      return null;
    }
    return { token: value.token, user: value.user as ChatPalezUser };
  } catch {
    return null;
  }
}

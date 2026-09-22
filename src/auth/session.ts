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

  await prepareNativeStorage();

  let raw: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      raw = await SecureStorage.getItem(SESSION_KEY);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (lastError) {
    throw new Error('The secure mobile session could not be restored.');
  }

  if (!raw) return null;

  const restored = parseSession(raw);
  if (!restored) {
    await SecureStorage.removeItem(SESSION_KEY);
    throw new Error('The stored mobile session is invalid. Please sign in again.');
  }

  current = restored;
  return current;
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

    // Verify persistence immediately. A successful API login is not enough:
    // local/API-driven screens must be able to restore the same token after
    // the WebView leaves the bundled app for retained web content.
    const persisted = await SecureStorage.getItem(SESSION_KEY);
    if (!persisted || !parseSession(persisted)) {
      throw new Error('Secure session verification failed.');
    }
  } catch (error) {
    current = null;
    throw new Error('ChatPalez could not securely save your mobile session.');
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
      // Key prefix applies on both Android and iOS.
      await SecureStorage.setKeyPrefix('chatpalez.');

      // These options configure the Apple Keychain/iCloud only. Calling them
      // during Android setup can prevent the secure store from initializing,
      // which in turn makes the native handoff lose its persisted JWT.
      if (Capacitor.getPlatform() === 'ios') {
        await SecureStorage.setSynchronize(false);
        await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
      }
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

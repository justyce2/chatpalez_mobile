import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ChatPalezApiClient, ApiError } from './api/client';
import { AuthService, type TwoFactorChallenge } from './api/auth';
import { NotificationsService } from './api/notifications';
import { RegistrationService } from './api/registration';
import { UserService } from './api/user';
import { clearSession, getAuthToken, restoreSession, setSession, type AuthSession } from './auth/session';
import { createAuthShell } from './auth-shell';
import { installPasswordRecovery } from './auth/password-recovery';
import { installRegistration, needsRegistrationCompletion, resumeRegistration, type RegistrationOptions } from './auth/registration';
import { renderTwoFactorChallenge } from './auth/two-factor';
import { getAppConfig } from './config';
import {
  initializeNativeNotifications,
  logoutNativeNotifications,
  requestNativeNotificationPermission
} from './notifications/native';
import { logDebug, logError, logInfo, logWarn } from './diagnostics';
import { registerNativeLifecycle } from './native-lifecycle';
import { openAuthenticatedWebModule } from './web-session';
import './styles.css';

const appRoot = document.querySelector<HTMLElement>('#app');
if (!appRoot) throw new Error('ChatPalez app root was not found.');
const root: HTMLElement = appRoot;

let config: ReturnType<typeof getAppConfig>;
try {
  config = getAppConfig();
} catch (error) {
  showFatalStartup(error);
  throw error;
}

let handlingSessionExpiry = false;
let pendingTrustedRoute: string | null = null;
let nativeLifecycleRegistration: Promise<void> | null = null;
let websiteTransitionStarted = false;

const api = new ChatPalezApiClient({
  config,
  getAuthToken,
  onUnauthorized: () => { void handleSessionExpiry(); }
});
const auth = new AuthService(api);
const notifications = new NotificationsService(api);
const registration = new RegistrationService(api);
const users = new UserService(api);

const shell = createAuthShell(root, async ({ usernameEmail, password }) => {
  shell.setBusy(true, 'Signing in…');
  try {
    const result = await auth.signIn({ usernameEmail, password });
    if ('requiresTwoFactor' in result) {
      renderTwoFactor(result);
      return;
    }
    await completeAuthenticatedSession(result);
  } catch (error) {
    logWarn('API sign-in failed', {
      status: error instanceof ApiError ? error.status : null,
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
    throw error;
  } finally {
    shell.setBusy(false);
  }
});

function registrationOptions(): RegistrationOptions {
  return {
    root,
    registration,
    onSessionCreated: (session) => {
      void setSession(session);
      logInfo('Mobile registration session stored', { userId: session.user.user_id });
    },
    onComplete: (session) => {
      void completeAuthenticatedSession(session);
    },
    onReturnToLogin: () => {
      void clearSession();
      renderLogin();
    }
  };
}

function renderLogin(error?: string): void {
  websiteTransitionStarted = false;
  shell.showLogin(error);
  installPasswordRecovery({
    root,
    auth,
    onReturnToLogin: () => renderLogin()
  });
  installRegistration(registrationOptions());
}

function renderTwoFactor(challenge: TwoFactorChallenge): void {
  logInfo('Two-factor challenge required', { userId: challenge.userId, method: challenge.method });
  renderTwoFactorChallenge({
    root,
    auth,
    challenge,
    onSuccess: (session) => {
      void completeAuthenticatedSession(session);
    },
    onCancel: () => renderLogin()
  });
}

async function completeAuthenticatedSession(session: AuthSession): Promise<void> {
  if (needsRegistrationCompletion(session)) {
    await setSession(session);
    await resumeRegistration(registrationOptions(), session);
    return;
  }
  await enterMobileWebsite(session, pendingTrustedRoute || '/');
}

async function enterMobileWebsite(session: AuthSession, path = '/'): Promise<void> {
  if (websiteTransitionStarted) return;
  websiteTransitionStarted = true;

  await setSession(session);
  logInfo('Native authentication completed; handing off to mobile website', {
    userId: session.user.user_id,
    path
  });

  try {
    await initializeNativeNotifications(config, users, session.user.user_id, (route) => {
      pendingTrustedRoute = route;
    });

    // Ask for native notification permission while the bundled native-auth page
    // is still active. This keeps push native even though the website owns the
    // post-login UI.
    await requestNativeNotificationPermission(config, users, session.user.user_id, (route) => {
      pendingTrustedRoute = route;
    });
  } catch (error) {
    logWarn('Native notifications could not be initialized before website handoff', {
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
  }

  const token = getAuthToken();
  if (!token) {
    websiteTransitionStarted = false;
    await clearSession();
    renderLogin('Your session is unavailable. Please sign in again.');
    return;
  }

  const targetPath = pendingTrustedRoute || path || '/';
  pendingTrustedRoute = null;
  document.body.classList.remove('auth-mode');

  // No target means the secure POST/303 transition replaces the local auth page
  // in the main Capacitor WebView with the full responsive ChatPalez website.
  openAuthenticatedWebModule({
    config,
    token,
    path: targetPath
  });
}

async function validateStoredSession(session: AuthSession): Promise<boolean> {
  try {
    // /notifications is an existing protected Sngine API endpoint. A successful
    // response proves the restored JWT still maps to a live server session.
    await notifications.getNotifications();
    return true;
  } catch (error) {
    logWarn('Stored mobile session is no longer valid', {
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
    await logoutNativeNotifications().catch(() => undefined);
    await clearSession();
    return false;
  }
}

async function handleSessionExpiry(): Promise<void> {
  if (handlingSessionExpiry || websiteTransitionStarted) return;
  handlingSessionExpiry = true;
  try {
    await logoutNativeNotifications().catch(() => undefined);
    await clearSession();
    renderLogin('Your session has expired. Please sign in again.');
  } finally {
    handlingSessionExpiry = false;
  }
}

async function ensureNativeLifecycleRegistration(): Promise<void> {
  if (!nativeLifecycleRegistration) {
    nativeLifecycleRegistration = registerNativeLifecycle(
      config,
      (route) => {
        logInfo('Trusted native route received', { path: route });
        pendingTrustedRoute = route;
      }
    ).catch((error) => {
      nativeLifecycleRegistration = null;
      throw error;
    });
  }
  await nativeLifecycleRegistration;
}

async function prepareNativeChrome(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (error) {
    logDebug('Status bar style was not applied', {
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
  }
}

async function bootstrap(): Promise<void> {
  shell.showStartup('Opening ChatPalez', 'Checking your connection…');
  websiteTransitionStarted = false;

  try {
    await ensureNativeLifecycleRegistration();
    await prepareNativeChrome();

    const network = await Network.getStatus();
    if (!network.connected) {
      shell.showStartup('You are offline', 'Connect to the internet, then try again.', true);
      return;
    }

    const session = await restoreSession();
    if (session && await validateStoredSession(session)) {
      await enterMobileWebsite(session, pendingTrustedRoute || '/');
      return;
    }

    renderLogin();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The app could not start.';
    logError('Auth-first website bootstrap failed', error, { platform: Capacitor.getPlatform() });
    shell.showStartup('Unable to start', detail, true);
  } finally {
    if (Capacitor.isNativePlatform()) {
      await SplashScreen.hide().catch(() => undefined);
    }
  }
}

function showFatalStartup(error: unknown): void {
  document.body.classList.add('auth-mode');
  root.replaceChildren();
  const card = document.createElement('section');
  card.className = 'state-card';
  const title = document.createElement('h1');
  title.textContent = 'Unable to start ChatPalez';
  const message = document.createElement('p');
  message.textContent = error instanceof Error ? error.message : 'The app could not start.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'primary-button';
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => window.location.reload());
  card.append(title, message, retry);
  root.append(card);
  if (Capacitor.isNativePlatform()) void SplashScreen.hide().catch(() => undefined);
}

shell.setRetryAction(() => { void bootstrap(); });

window.addEventListener('error', (event) => {
  logError('Unhandled window error', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled promise rejection', event.reason);
});

void bootstrap();

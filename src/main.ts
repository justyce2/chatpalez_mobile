import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createAppShell } from './app-shell';
import { ChatPalezApiClient, ApiError } from './api/client';
import { AuthService } from './api/auth';
import { ChatService } from './api/chat';
import { clearSession, getAuthToken, getSession, setSession } from './auth/session';
import { getAppConfig } from './config';
import { logDebug, logError, logInfo, logWarn } from './diagnostics';
import { registerNativeLifecycle } from './native-lifecycle';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('ChatPalez app root was not found.');

const config = getAppConfig();
const api = new ChatPalezApiClient({ config, getAuthToken });
const auth = new AuthService(api);
const chat = new ChatService(api);

const shell = createAppShell(root, {
  onLogin: async ({ usernameEmail, password }) => {
    shell.setBusy(true, 'Signing in…');
    try {
      const session = await auth.signIn({ usernameEmail, password });
      setSession(session);
      logInfo('API sign-in completed', { userId: session.user.user_id });
      shell.showAuthenticated(session);
    } catch (error) {
      logWarn('API sign-in failed', {
        status: error instanceof ApiError ? error.status : null,
        detail: error instanceof Error ? error.message : String(error ?? '')
      });
      throw error;
    } finally {
      shell.setBusy(false);
    }
  },
  onLogout: async () => {
    shell.setBusy(true, 'Signing out…');
    try {
      await auth.signOut();
    } catch (error) {
      logWarn('Server sign-out did not complete cleanly', {
        detail: error instanceof Error ? error.message : String(error ?? '')
      });
    } finally {
      clearSession();
      shell.setBusy(false);
      shell.showLogin();
    }
  },
  onOpenWebModule: (path) => {
    const destination = new URL(path, config.origin);
    logInfo('Web-backed module requested', { url: destination.toString() });
    window.alert('This web-backed section is waiting for the API-to-web session bridge. Your mobile API session remains signed in.');
  },
  onLoadConversations: async () => {
    const conversations = await chat.getConversations();
    logInfo('Conversation list loaded', { count: conversations.length });
    return conversations;
  }
});

async function prepareNativeChrome(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
  } catch (error) {
    logDebug('Status bar style was not applied', {
      platform: Capacitor.getPlatform(),
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
  }
}

async function bootstrap(): Promise<void> {
  shell.showStartup('Opening ChatPalez', 'Checking your connection…');
  logInfo('Progressive shell bootstrap started', { platform: Capacitor.getPlatform() });

  try {
    await registerNativeLifecycle(config, (route) => {
      const destination = new URL(route, config.origin);
      logInfo('Trusted native route received', { url: destination.toString() });
      window.alert('This link will open after the local-to-web session bridge is enabled.');
    });

    const network = await Network.getStatus();
    if (!network.connected) {
      logWarn('Bootstrap paused because device is offline', {
        connectionType: network.connectionType
      });
      shell.showStartup('You are offline', 'Connect to the internet, then reopen ChatPalez.');
      return;
    }

    const session = getSession();
    if (session) {
      logInfo('Restored in-process mobile API session', { userId: session.user.user_id });
      shell.showAuthenticated(session);
    } else {
      shell.showLogin();
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The app could not start.';
    logError('Progressive shell bootstrap failed', error, { platform: Capacitor.getPlatform() });
    shell.showStartup('Unable to start', detail);
  } finally {
    if (Capacitor.isNativePlatform()) {
      await SplashScreen.hide().catch((error) => {
        logDebug('Splash screen hide was unavailable', {
          detail: error instanceof Error ? error.message : String(error ?? '')
        });
      });
    }
  }
}

void Network.addListener('networkStatusChange', (status) => {
  logInfo('Network state changed', {
    connected: status.connected,
    connectionType: status.connectionType
  });

  if (!status.connected) {
    logWarn('Device went offline while app was active');
  }
});

window.addEventListener('error', (event) => {
  logError('Unhandled window error', event.error ?? event.message, {
    source: event.filename || null,
    line: event.lineno || null,
    column: event.colno || null
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled promise rejection', event.reason);
});

void prepareNativeChrome().then(bootstrap).catch((error) => {
  logError('Native bootstrap pipeline failed', error, { platform: Capacitor.getPlatform() });
});

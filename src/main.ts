import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createAppShell } from './app-shell';
import { ChatPalezApiClient, ApiError } from './api/client';
import { AuthService, type TwoFactorChallenge } from './api/auth';
import { ChatService } from './api/chat';
import { NotificationsService } from './api/notifications';
import { RegistrationService } from './api/registration';
import { UserService } from './api/user';
import { UploadService } from './api/uploads';
import { clearSession, getAuthToken, getSession, restoreSession, setSession, type AuthSession } from './auth/session';
import { installPasswordRecovery } from './auth/password-recovery';
import { installRegistration, needsRegistrationCompletion, resumeRegistration, type RegistrationOptions } from './auth/registration';
import { renderTwoFactorChallenge } from './auth/two-factor';
import { getAppConfig } from './config';
import { getChatPhotoUrl } from './media';
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

const config = getAppConfig();
const api = new ChatPalezApiClient({ config, getAuthToken });
const auth = new AuthService(api);
const chat = new ChatService(api);
const notifications = new NotificationsService(api);
const registration = new RegistrationService(api);
const users = new UserService(api);
const uploads = new UploadService(api);

function registrationOptions(): RegistrationOptions {
  return {
    root,
    registration,
    onSessionCreated: (session) => {
      void setSession(session);
      logInfo('Mobile registration session stored', { userId: session.user.user_id });
    },
    onComplete: (session) => {
      void showAuthenticatedSession(session);
    },
    onReturnToLogin: () => {
      void clearSession();
      renderLogin();
    }
  };
}

function renderLogin(error?: string): void {
  shell.showLogin(error);
  installPasswordRecovery({
    root,
    auth,
    onReturnToLogin: () => renderLogin()
  });
  installRegistration(registrationOptions());
}

async function showAuthenticatedSession(session: AuthSession): Promise<void> {
  await setSession(session);
  logInfo('Mobile authentication completed', { userId: session.user.user_id });
  shell.showAuthenticated(session);
  void initializeNativeNotifications(config, users, session.user.user_id, openWebModule).catch((error) => {
    logWarn('Native notification identity could not be initialized', {
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
  });
}

async function completeAuthenticatedSession(session: AuthSession): Promise<void> {
  if (needsRegistrationCompletion(session)) {
    await setSession(session);
    logInfo('Mobile account requires registration completion', { userId: session.user.user_id });
    await resumeRegistration(registrationOptions(), session);
    return;
  }
  await showAuthenticatedSession(session);
}

function openWebModule(path: string): void {
  const token = getAuthToken();
  if (!token) {
    void clearSession();
    renderLogin('Your session has expired. Sign in again to continue.');
    return;
  }

  try {
    logInfo('Authenticated retained-web transition requested', { path });
    openAuthenticatedWebModule({ config, token, path });
  } catch (error) {
    logWarn('Retained-web transition was blocked', {
      path,
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
    window.alert(error instanceof Error ? error.message : 'Unable to open this ChatPalez section.');
  }
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

const shell = createAppShell(root, {
  onLogin: async ({ usernameEmail, password }) => {
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
      await logoutNativeNotifications().catch((error) => {
        logWarn('Native notification identity could not be cleared', {
          detail: error instanceof Error ? error.message : String(error ?? '')
        });
      });
      await clearSession();
      shell.setBusy(false);
      renderLogin();
    }
  },
  onOpenWebModule: openWebModule,
  resolveChatPhotoUrl: (source) => getChatPhotoUrl(config.origin, source),
  onManageNotifications: async () => {
    const session = getSession();
    if (!session) throw new Error('Your session has expired. Sign in again to continue.');
    return requestNativeNotificationPermission(config, users, session.user.user_id, openWebModule);
  },
  onLoadConversations: async () => {
    const conversations = await chat.getConversations();
    logInfo('Conversation list loaded', { count: conversations.length });
    return conversations;
  },
  onLoadContacts: async (query) => {
    const contacts = await chat.getContacts(query);
    logDebug('Chat contacts loaded', { query, count: contacts.length });
    return contacts;
  },
  onStartConversation: async (recipientId, message) => {
    const conversation = await chat.startConversation(recipientId, message);
    logInfo('Conversation started', { conversationId: conversation.conversation_id, recipientId });
    return conversation;
  },
  onLoadMessages: async (conversationId) => {
    const result = await chat.getMessages(conversationId);
    logDebug('Conversation messages loaded', {
      conversationId,
      count: result.messages?.length ?? 0
    });
    return result;
  },
  onSendMessage: async (conversationId, message, photo) => {
    const photoSource = photo ? await uploads.uploadChatPhoto(photo) : '';
    await chat.sendMessage(conversationId, message, photoSource);
    logInfo('Message sent', { conversationId });
  },
  onTyping: async (conversationId, isTyping) => {
    await chat.setTyping(conversationId, isTyping);
  },
  onLeaveConversation: async (conversationId) => {
    await chat.leaveConversation(conversationId);
  },
  onDeleteConversation: async (conversationId) => {
    await chat.deleteConversation(conversationId);
  },
  onReactToMessage: async (messageId, reaction) => {
    await chat.reactToMessage(messageId, reaction);
  },
  onDeleteMessage: async (messageId) => {
    await chat.deleteMessage(messageId);
  },
  onMarkSeen: async (ids) => {
    await chat.markSeen(ids);
  },
  onLoadNotifications: async () => {
    const items = await notifications.getNotifications();
    logInfo('Notifications loaded', { count: items.length });
    return items;
  },
  onLoadBlockedUsers: async () => {
    const blocked = await users.getBlockedUsers();
    logInfo('Blocked-user list loaded', { count: blocked.length });
    return blocked;
  },
  onDeleteAccount: async (password) => {
    await users.deleteAccount(password);
    await logoutNativeNotifications().catch((error) => {
      logWarn('Native notification identity could not be cleared after account deletion', {
        detail: error instanceof Error ? error.message : String(error ?? '')
      });
    });
    await clearSession();
    logInfo('Account deletion completed');
    renderLogin('Your account has been deleted.');
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
      logInfo('Trusted native route received', { path: route });
      openWebModule(route);
    });

    const network = await Network.getStatus();
    if (!network.connected) {
      logWarn('Bootstrap paused because device is offline', {
        connectionType: network.connectionType
      });
      shell.showStartup('You are offline', 'Connect to the internet, then reopen ChatPalez.');
      return;
    }

    const session = await restoreSession();
    if (session) {
      logInfo('Restored in-process mobile API session', { userId: session.user.user_id });
      await completeAuthenticatedSession(session);
    } else {
      renderLogin();
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

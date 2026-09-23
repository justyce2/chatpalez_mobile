import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createAppShell } from './app-shell';
import { ChatPalezApiClient, ApiError } from './api/client';
import { AuthService, type TwoFactorChallenge } from './api/auth';
import { ChatService } from './api/chat';
import { ChatRealtimeService, RealtimeDeliveryUncertainError } from './chat-realtime';
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
  logoutNativeNotifications,
  requestNativeNotificationPermission
} from './notifications/native';
import { logDebug, logError, logInfo, logWarn } from './diagnostics';
import { registerNativeLifecycle } from './native-lifecycle';
import { openAuthenticatedWebModule } from './web-session';
import { installMobileBridge } from './bridge';
import { bindWebBridgeEvents } from './web-bridge-events';
import { webContentSurface } from './web-content-surface';
import './styles.css';

const appRoot = document.querySelector<HTMLElement>('#app');
if (!appRoot) throw new Error('ChatPalez app root was not found.');
const root: HTMLElement = appRoot;

const config = getAppConfig();
const mobileBridge = installMobileBridge(config);
bindWebBridgeEvents(mobileBridge, config);
let handlingSessionExpiry = false;
let nativeLifecycleRegistration: Promise<void> | null = null;
let webSurfaceRouteRegistration: Promise<void> | null = null;
let webSurfaceCommandRegistration: Promise<void> | null = null;
const api = new ChatPalezApiClient({
  config,
  getAuthToken,
  onUnauthorized: () => { void handleSessionExpiry(); }
});
const auth = new AuthService(api);
const chat = new ChatService(api);
const chatRealtime = new ChatRealtimeService(config.chatSocketUrl);
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
    },
    onOpenPublicPage: openPublicModule
  };
}

async function handleSessionExpiry(): Promise<void> {
  if (handlingSessionExpiry) return;
  handlingSessionExpiry = true;
  try {
    // Do not destroy the native API session because one protected endpoint
    // returned 401. During retained-web/local transitions a routing, CORS or
    // backend endpoint problem must not masquerade as a logout. The calling
    // local screen will surface its own API error while the secure session is
    // preserved for retry and diagnosis. Explicit sign-out still clears it.
    logWarn('Protected mobile API request returned 401; preserving secure session for local-screen recovery');
  } finally {
    handlingSessionExpiry = false;
  }
}

function renderLogin(error?: string): void {
  chatRealtime.disconnect();
  void webContentSurface.reset();
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
  chatRealtime.connect(session.token);
  logInfo('Mobile authentication completed', { userId: session.user.user_id });

  try {
    await requestNativeNotificationPermission(config, users, session.user.user_id, openWebModule);
  } catch (error) {
    logWarn('Native notification permission/identity could not be initialized', {
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
  }

  // Keep the shared Capacitor shell resident after authentication. Retained
  // Sngine pages are opened inside the shell rather than replacing the app root.
  shell.showAuthenticated(session, 'home');
}

function requestedNativeScreen(): 'feed' | 'messages' | 'notifications' | 'profile' | null {
  const params = new URL(window.location.href).searchParams;
  const target = params.get('native');
  if (target === 'feed') return 'feed';
  if (target === 'messages') return 'messages';
  if (target === 'notifications') return 'notifications';
  if (target === 'profile') return 'profile';
  return null;
}

function requestedWebPath(): string | null {
  const params = new URL(window.location.href).searchParams;
  const requested = params.get('web');
  if (requested === null) return null;

  // Retained modules may only request first-party internal paths.
  // normalizeInternalPath is applied again inside openAuthenticatedWebModule.
  return requested.startsWith('/') ? requested : '/';
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

function openPublicModule(path: string): void {
  const destination = new URL(path, config.origin);
  if (!config.allowedHosts.has(destination.hostname.toLowerCase())) {
    throw new Error('ChatPalez blocked an untrusted public destination.');
  }

  // Public/legal pages stay inside the dedicated native web surface as well.
  // This keeps the shared ChatPalez header and its Back control available
  // instead of replacing the primary Capacitor WebView.
  const token = getAuthToken();
  if (token && webContentSurface.isSupported()) {
    void openWebModule(path);
    return;
  }

  const titles: Record<string, string> = {
    '/static/privacy': 'Privacy Policy',
    '/static/terms': 'Terms',
    '/static/childsafetypolicy': 'Child Safety'
  };
  const frame = shell.showPublicPage(titles[destination.pathname] || 'ChatPalez', () => renderLogin());
  if (frame instanceof HTMLIFrameElement) {
    shell.setBusy(true, 'Loading page…');
    frame.addEventListener('load', () => shell.setBusy(false), { once: true });
    frame.addEventListener('error', () => shell.setBusy(false), { once: true });
    frame.src = destination.toString();
  }
}

async function openWebModule(path: string, target?: string): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    void clearSession();
    renderLogin('Your session has expired. Sign in again to continue.');
    return;
  }

  try {
    const network = await Network.getStatus();
    if (!network.connected) {
      window.alert('This ChatPalez section needs an internet connection. Reconnect and try again.');
      return;
    }
    logInfo('Authenticated retained-web transition requested', { path, target: target ?? null });

    if (webContentSurface.isSupported()) {
      shell.setBusy(true, 'Loading page…');
      let loaded = false;
      const stop = await webContentSurface.onLoadFinished(() => {
        if (loaded) return;
        loaded = true;
        shell.setBusy(false);
        void stop();
      });
      try {
        await webContentSurface.openAuthenticated(config, token, path);
        window.setTimeout(() => {
          if (!loaded) {
            loaded = true;
            shell.setBusy(false);
            void stop();
          }
        }, 15000);
      } catch (error) {
        shell.setBusy(false);
        void stop();
        throw error;
      }
      return;
    }

    // Browser-only fallback. Installed Android/iOS builds use the dedicated
    // native content surface so the shared Capacitor chrome remains resident.
    openAuthenticatedWebModule({ config, token, path, target });
  } catch (error) {
    logWarn('Retained-web transition was blocked', {
      path,
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
    window.alert(error instanceof Error ? error.message : 'Unable to open this ChatPalez section.');
  }
}

async function ensureWebSurfaceCommandRegistration(): Promise<void> {
  if (!webSurfaceCommandRegistration && webContentSurface.isSupported()) {
    webSurfaceCommandRegistration = webContentSurface.onCommand((command) => {
      if (command.type === 'share') {
        void mobileBridge.share((command.payload ?? {}) as import('./bridge').SharePayload);
        return;
      }

      if (command.type === 'pick-media' && command.requestId) {
        void mobileBridge.pickMedia((command.payload ?? {}) as import('./bridge').MediaPickerPayload)
          .then((items) => webContentSurface.postMessage({
            source: 'chatpalez-shell',
            type: 'media-result',
            requestId: command.requestId,
            items
          }));
        return;
      }

      if (command.type === 'open-external') {
        const url = (command.payload as { url?: string } | undefined)?.url;
        if (url) void mobileBridge.openExternal(url);
        return;
      }

      if (command.type === 'open-native') {
        const screen = (command.payload as { screen?: string } | undefined)?.screen;
        if (screen !== 'messages' && screen !== 'notifications' && screen !== 'profile') return;
        const session = getSession();
        if (!session) {
          renderLogin('Your session has expired. Sign in again to continue.');
          return;
        }
        void shell.navigateToNative(screen);
      }
    }).then(() => undefined).catch((error) => {
      webSurfaceCommandRegistration = null;
      throw error;
    });
  }
  await webSurfaceCommandRegistration;
}

async function ensureWebSurfaceRouteRegistration(): Promise<void> {
  if (!webSurfaceRouteRegistration && webContentSurface.isSupported()) {
    webSurfaceRouteRegistration = webContentSurface.onRouteChanged((url) => {
      mobileBridge.notifyRouteChanged(url);
      void webContentSurface.canGoBack()
        .then((available) => shell.setWebBackAvailable(available))
        .catch(() => shell.setWebBackAvailable(false));
    }).then(() => undefined).catch((error) => {
      webSurfaceRouteRegistration = null;
      throw error;
    });
  }
  await webSurfaceRouteRegistration;
}

async function ensureNativeLifecycleRegistration(): Promise<void> {
  if (!nativeLifecycleRegistration) {
    nativeLifecycleRegistration = registerNativeLifecycle(
      config,
      (route) => {
        logInfo('Trusted native route received', { path: route });
        void openWebModule(route);
      },
      (screen) => {
        const session = getSession();
        if (!session) {
          renderLogin('Your session has expired. Sign in again to continue.');
          return;
        }

        logInfo('Native app screen requested from retained web module', { screen });
        void shell.navigateToNative(screen);
      },
      () => shell.navigateBack()
    ).catch((error) => {
      nativeLifecycleRegistration = null;
      throw error;
    });
  }
  await nativeLifecycleRegistration;
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
      await webContentSurface.reset().catch(() => undefined);
      shell.setBusy(false);
      renderLogin();
    }
  },
  onOpenWebModule: openWebModule,
  onHideWebModule: () => { void webContentSurface.hide(); },
  onCanGoBackWebModule: () => webContentSurface.canGoBack(),
  onGoBackWebModule: () => webContentSurface.goBack(),
  onShowCreateActions: webContentSurface.isSupported() ? () => webContentSurface.showCreateActions() : undefined,
  onOpenPublicPage: openPublicModule,
  resolveChatPhotoUrl: (source) => getChatPhotoUrl(config.origin, source),
  onLoadProfile: async () => {
    const profile = await users.getProfile();
    logInfo('Native profile loaded', { userId: profile.user_id });
    return profile;
  },
  onLoadAccount: async () => users.getAccount(),
  onUpdateProfile: async (payload) => users.updateProfile(payload),
  onUpdateIdentity: async (payload) => users.updateIdentity(payload),
  onUpdateWork: async (payload) => users.updateWork(payload),
  onUpdateLocation: async (payload) => users.updateLocation(payload),
  onUpdateEducation: async (payload) => users.updateEducation(payload),
  onUpdateSocial: async (payload) => users.updateSocial(payload),
  onUpdatePassword: async (payload) => users.updatePassword(payload),
  onUpdatePrivacy: async (payload) => users.updatePrivacy(payload),
  onManageNotifications: async () => {
    const session = getSession();
    if (!session) throw new Error('Your session has expired. Sign in again to continue.');
    return requestNativeNotificationPermission(config, users, session.user.user_id, openWebModule);
  },
  onLoadConversations: async (offset) => {
    const page = await chat.getConversationsPage(offset);
    logInfo('Conversation list loaded', { count: page.data.length, offset, hasMore: page.hasMore });
    return { items: page.data, hasMore: page.hasMore };
  },
  onLoadContacts: async (query, offset) => {
    const page = await chat.getContactsPage(query, offset);
    logDebug('Chat contacts loaded', { query, count: page.data.length, offset, hasMore: page.hasMore });
    return { items: page.data, hasMore: page.hasMore };
  },
  onStartConversation: async (recipientId, message) => {
    const conversation = await chat.startConversation(recipientId, message);
    logInfo('Conversation started', { conversationId: conversation.conversation_id, recipientId });
    return conversation;
  },
  onStartGroupConversation: async (recipientIds, message) => {
    const conversation = await chat.startGroupConversation(recipientIds, message);
    logInfo('Group conversation started', { conversationId: conversation.conversation_id, recipientCount: recipientIds.length });
    return conversation;
  },
  onLoadMessages: async (conversationId, offset) => {
    const result = await chat.getMessages(conversationId, offset);
    logDebug('Conversation messages loaded', {
      conversationId,
      offset,
      count: result.messages?.length ?? 0
    });
    return result;
  },
  onSendMessage: async (conversationId, message, photo) => {
    /*
     * Keep uploads on HTTP. Plain text may use Socket.IO when connected, but
     * failure falls back to the existing HTTP path so realtime availability
     * never becomes a requirement for sending.
     */
    if (!photo && chatRealtime.isConnected()) {
      try {
        await chatRealtime.sendMessage(conversationId, message);
        logInfo('Message sent through realtime chat', { conversationId });
        return;
      } catch (error) {
        if (!chatRealtime.isConnected()) {
          logWarn('Realtime disconnected before delivery confirmation; suppressing automatic HTTP retry', {
            conversationId
          });
          throw new RealtimeDeliveryUncertainError();
        }
        if (error instanceof RealtimeDeliveryUncertainError) {
          /*
           * A timeout can happen after the server persisted the message but
           * before the acknowledgement reached this device. Retrying over HTTP
           * here could duplicate the message, so surface an uncertain result
           * and let ChatScreen resync before the user chooses to retry.
           */
          logWarn('Realtime message acknowledgement was lost; suppressing automatic HTTP retry', {
            conversationId
          });
          throw error;
        }
        logWarn('Realtime message send failed before delivery confirmation; falling back to HTTP', {
          conversationId,
          detail: error instanceof Error ? error.message : String(error ?? '')
        });
      }
    }
    const photoSource = photo ? await uploads.uploadChatPhoto(photo) : '';
    await chat.sendMessage(conversationId, message, photoSource);
    logInfo('Message sent through HTTP chat', { conversationId });
  },
  onTyping: async (conversationId, isTyping) => {
    if (chatRealtime.isConnected()) {
      chatRealtime.setTyping(conversationId, isTyping);
      return;
    }
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
    /*
     * ChatScreen passes message IDs here and the HTTP API owns that contract.
     * The Socket.IO seen event uses a different contract: ids contains exactly
     * one CONVERSATION ID. Never substitute message IDs into that event.
     */
    await chat.markSeen(ids);
  },
  onOpenConversation: (conversation, events) => {
    const conversationId = conversation.conversation_id;
    chatRealtime.openConversation(conversationId);
    const currentConversationId = String(conversationId);
    const participantIds = new Set(
      (conversation.recipients ?? []).map((recipient) => String(recipient.user_id))
    );
    const stop = chatRealtime.subscribe({
      onMessage: (event) => {
        if (String(event.conversation?.conversation_id ?? '') === currentConversationId) void events.refresh();
      },
      onTyping: (event) => {
        if (String(event.conversation_id) === currentConversationId) {
          events.setTyping(String(event.typing_name_list ?? ''));
        }
      },
      onSeen: (event) => {
        if (String(event.conversation_id) === currentConversationId) {
          events.setSeen(String(event.seen_name_list ?? ''));
        }
      },
      onConversationDeleted: (event) => {
        if (String(event.conversation_id) === currentConversationId) events.close('This conversation is no longer available.');
      },
      onConversationLeft: (event) => {
        if (String(event.conversation_id) === currentConversationId) events.close('You are no longer a participant in this conversation.');
      },
      onUserOnline: (event) => {
        if (!conversation.multiple_recipients && participantIds.has(String(event.user_id))) events.setPresence(true);
      },
      onUserOffline: (event) => {
        if (!conversation.multiple_recipients && participantIds.has(String(event.user_id))) {
          events.setPresence(false, event.user_last_seen ? String(event.user_last_seen) : undefined);
        }
      },
      onConnect: () => { void events.refresh(); },
      onError: (message) => logWarn('Realtime chat event failed; HTTP chat remains available', { message })
    });
    return () => {
      stop();
      chatRealtime.closeConversation(conversationId);
    };
  },
  onLoadNotifications: async () => {
    const items = await notifications.getNotifications();
    logInfo('Notifications loaded', { count: items.length });
    return items;
  },
  onLoadBlockedUsers: async (offset) => {
    const page = await users.getBlockedUsersPage(offset);
    logInfo('Blocked-user list loaded', { count: page.data.length, offset, hasMore: page.hasMore });
    return { items: page.data, hasMore: page.hasMore };
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

shell.setRetryAction(() => { void bootstrap(); });

async function prepareNativeUi(): Promise<void> {
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
    await ensureNativeLifecycleRegistration();
    await ensureWebSurfaceRouteRegistration();
    await ensureWebSurfaceCommandRegistration();

    const network = await Network.getStatus();
    if (!network.connected) {
      logWarn('Bootstrap paused because device is offline', {
        connectionType: network.connectionType
      });
      shell.showStartup('You are offline', 'Connect to the internet, then try again.', true);
      return;
    }

    const session = await restoreSession();
    if (session) {
      chatRealtime.connect(session.token);
      logInfo('Restored in-process mobile API session', { userId: session.user.user_id });
      const nativeScreen = requestedNativeScreen();
      const webPath = requestedWebPath();
      if (webPath) {
        logInfo('Opening retained web module through restored mobile session', { path: webPath });
        await openWebModule(webPath);
      } else if (nativeScreen === 'feed') {
        shell.showAuthenticated(session, 'home');
      } else if (nativeScreen === 'messages') {
        logInfo('Opening API-driven native messaging screen');
        shell.showAuthenticated(session, 'messages');
      } else if (nativeScreen === 'notifications') {
        logInfo('Opening API-driven native notifications screen');
        shell.showAuthenticated(session, 'notifications');
      } else if (nativeScreen === 'profile') {
        logInfo('Opening API-driven native profile screen');
        shell.showAuthenticated(session, 'profile');
      } else {
        await completeAuthenticatedSession(session);
      }
    } else {
      const nativeScreen = requestedNativeScreen();
      if (nativeScreen && nativeScreen !== 'feed') {
        shell.showStartup(
          'Unable to restore your mobile session',
          'ChatPalez could not recover the secure API session required for this local screen. Return to the app login and sign in again.',
          true
        );
      } else {
        renderLogin();
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The app could not start.';
    logError('Progressive shell bootstrap failed', error, { platform: Capacitor.getPlatform() });
    shell.showStartup('Unable to start', detail, true);
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

window.addEventListener('resize', () => {
  void webContentSurface.syncFrame().catch((error) => {
    logDebug('Native web-content surface frame could not be synchronized', {
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
  });
});

void Network.addListener('networkStatusChange', (status) => {
  logInfo('Network state changed', {
    connected: status.connected,
    connectionType: status.connectionType
  });

  if (!status.connected) {
    logWarn('Device went offline while app was active');
    chatRealtime.pause();
    return;
  }

  if (getAuthToken()) chatRealtime.resume();
});

window.addEventListener('chatpalez:app-state', (event) => {
  const detail = (event as CustomEvent<{ isActive?: boolean }>).detail;
  if (detail?.isActive) {
    if (getAuthToken()) chatRealtime.resume();
    return;
  }
  chatRealtime.pause();
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

void prepareNativeUi().then(bootstrap).catch((error) => {
  logError('Native bootstrap pipeline failed', error, { platform: Capacitor.getPlatform() });
});

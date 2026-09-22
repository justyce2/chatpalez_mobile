import type { ChatContact, Conversation, Message, MessagesResult } from './api/chat';
import type { NotificationItem } from './api/notifications';
import type { BlockedUser } from './api/user';
import type { AuthSession } from './auth/session';
import type { NativeNotificationStatus } from './notifications/native';

export type LoginCredentials = {
  usernameEmail: string;
  password: string;
};

export type PageResult<T> = { items: T[]; hasMore: boolean; };

export type AppShellHandlers = {
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  onLogout: () => Promise<void>;
  onOpenWebModule: (path: string) => void;
  onOpenPublicPage?: (path: string) => void;
  resolveChatPhotoUrl?: (source: string) => string | null;
  onManageNotifications?: () => Promise<NativeNotificationStatus>;
  onLoadConversations?: (offset: number) => Promise<PageResult<Conversation>>;
  onLoadContacts?: (query: string, offset: number) => Promise<PageResult<ChatContact>>;
  onStartConversation?: (recipientId: number | string, message: string) => Promise<Conversation>;
  onStartGroupConversation?: (recipientIds: Array<number | string>, message: string) => Promise<Conversation>;
  onLoadMessages?: (conversationId: number | string, offset: number) => Promise<MessagesResult>;
  onSendMessage?: (conversationId: number | string, message: string, photo?: File) => Promise<void>;
  onTyping?: (conversationId: number | string, isTyping: boolean) => Promise<void>;
  onLeaveConversation?: (conversationId: number | string) => Promise<void>;
  onDeleteConversation?: (conversationId: number | string) => Promise<void>;
  onReactToMessage?: (messageId: number | string, reaction: string) => Promise<void>;
  onDeleteMessage?: (messageId: number | string) => Promise<void>;
  onMarkSeen?: (ids: Array<number | string>) => Promise<void>;
  onLoadNotifications?: () => Promise<NotificationItem[]>;
  onLoadBlockedUsers?: (offset: number) => Promise<PageResult<BlockedUser>>;
  onDeleteAccount?: (password: string) => Promise<void>;
};

export type AppShell = {
  showStartup: (title: string, message: string, canRetry?: boolean) => void;
  showLogin: (error?: string) => void;
  showAuthenticated: (session: AuthSession, initialTab?: 'home' | 'messages' | 'notifications' | 'profile') => void;
  setBusy: (busy: boolean, message?: string) => void;
  setRetryAction: (action: () => void) => void;
};

export function createAppShell(root: HTMLElement, handlers: AppShellHandlers): AppShell {
  let retryAction: (() => void) | null = null;

  const showStartup = (title: string, message: string, canRetry = false): void => {
    root.replaceChildren();
    const card = element('section', 'state-card');
    card.append(brandMark(), heading(title), paragraph(message));
    if (canRetry && retryAction) {
      const button = actionButton('Try again');
      button.addEventListener('click', retryAction);
      card.append(button);
    }
    root.append(card);
  };

  const showLogin = (error?: string): void => {
    root.replaceChildren();
    const wrap = element('section', 'auth-screen');
    const header = element('div', 'auth-header');
    header.append(brandMark(), heading('Welcome to ChatPalez'));
    header.append(paragraph('Sign in to continue to your mobile experience.'));
    const form = document.createElement('form');
    form.className = 'auth-form';
    const identity = input('text', 'Email or username', 'usernameEmail');
    identity.autocomplete = 'username';
    const password = input('password', 'Password', 'password');
    password.autocomplete = 'current-password';
    const passwordControl = passwordField(password);
    const errorBox = element('p', 'form-error');
    errorBox.hidden = !error;
    errorBox.textContent = error ?? '';
    const submit = actionButton('Sign in');
    submit.type = 'submit';
    form.append(field('Email or username', identity), field('Password', passwordControl), errorBox, submit);
    if (handlers.onOpenPublicPage) form.append(policyLinks(handlers.onOpenPublicPage));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      submit.disabled = true;
      submit.textContent = 'Signing in…';
      void handlers.onLogin({ usernameEmail: identity.value, password: password.value }).catch((reason: unknown) => {
        errorBox.textContent = reason instanceof Error ? reason.message : 'Unable to sign in.';
        errorBox.hidden = false;
        submit.disabled = false;
        submit.textContent = 'Sign in';
      });
    });
    wrap.append(header, form);
    root.append(wrap);
  };

  const showAuthenticated = (session: AuthSession, initialTab: 'home' | 'messages' | 'notifications' | 'profile' = 'home'): void => {
    root.replaceChildren();
    const user = session.user;
    const displayName = String(user.user_fullname || user.user_firstname || user.user_name || 'ChatPalez');
    const layout = element('section', 'mobile-layout');
    const topbar = element('header', 'mobile-topbar');
    const brand = element('div', 'topbar-brand');
    brand.append(brandMark('small'), elementWithText('strong', 'ChatPalez'));
    const avatar = document.createElement('button');
    avatar.type = 'button';
    avatar.className = 'avatar-button';
    avatar.setAttribute('aria-label', 'Account');
    avatar.textContent = initials(displayName);
    avatar.addEventListener('click', () => void selectTab('profile'));
    topbar.append(brand, avatar);

    const content = element('main', 'mobile-content');
    const nav = element('nav', 'bottom-tabs');
    nav.setAttribute('aria-label', 'Primary');
    const tabs = [
      { id: 'home', label: 'Home' },
      { id: 'messages', label: 'Chat' },
      { id: 'notifications', label: 'Alerts' },
      { id: 'profile', label: 'Profile' }
    ] as const;
    const buttons = new Map<string, HTMLButtonElement>();
    for (const tab of tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab-button';
      button.dataset.tab = tab.id;
      button.textContent = tab.label;
      button.addEventListener('click', () => void selectTab(tab.id));
      buttons.set(tab.id, button);
      nav.append(button);
    }

    async function selectTab(tab: string): Promise<void> {
      for (const [id, button] of buttons) button.classList.toggle('is-active', id === tab);
      content.replaceChildren();
      if (tab === 'home') {
        // Home remains on the stable ChatPalez app theme until the native feed API
        // is explicitly re-enabled and device-validated.
        handlers.onOpenWebModule('/');
        return;
      }
      if (tab === 'messages') {
        await showConversationList();
        return;
      }
      if (tab === 'notifications') {
        await showNotifications();
        return;
      }
      showProfile();
    }


    function showProfile(): void {
      content.replaceChildren(screenTitle('Profile'));
      const profileCard = element('div', 'profile-card');
      profileCard.append(elementWithText('strong', displayName));
      if (user.user_email) profileCard.append(elementWithText('span', String(user.user_email)));
      if (user.user_name) profileCard.append(elementWithText('span', `@${String(user.user_name)}`));
      content.append(profileCard);
      const settings = secondaryButton('Account & settings');
      settings.addEventListener('click', () => void showSettings());
      const logout = secondaryButton('Sign out');
      logout.addEventListener('click', () => void handlers.onLogout());
      content.append(settings, logout);
    }

    async function showSettings(): Promise<void> {
      content.replaceChildren();
      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', showProfile);
      header.append(back, screenTitle('Account & settings'));
      content.append(header);

      const account = element('section', 'settings-card');
      account.append(elementWithText('h3', 'Account'));
      account.append(elementWithText('strong', displayName));
      if (user.user_email) account.append(elementWithText('span', String(user.user_email)));
      content.append(account);

      const push = element('section', 'settings-card');
      push.append(elementWithText('h3', 'Push notifications'));
      const pushStatus = paragraph('Enable notifications for messages and account activity on this device.');
      push.append(pushStatus);
      if (handlers.onManageNotifications) {
        const enablePush = secondaryButton('Enable notifications');
        enablePush.addEventListener('click', () => {
          enablePush.disabled = true;
          enablePush.textContent = 'Checking…';
          void handlers.onManageNotifications!()
            .then((status) => {
              pushStatus.textContent = nativeNotificationStatusMessage(status);
              enablePush.textContent = status === 'enabled' ? 'Notifications enabled' : 'Manage notifications';
            })
            .catch((error: unknown) => {
              pushStatus.textContent = error instanceof Error ? error.message : 'Unable to update notification permission.';
              enablePush.textContent = 'Try again';
            })
            .finally(() => {
              enablePush.disabled = false;
            });
        });
        push.append(enablePush);
      } else {
        pushStatus.textContent = 'Native notification controls are not available in this build.';
      }
      content.append(push);

      const blockedSection = element('section', 'settings-card');
      blockedSection.append(elementWithText('h3', 'Blocked users'));
      const blockedBody = element('div', 'settings-list');
      blockedBody.append(paragraph('Loading blocked users…'));
      blockedSection.append(blockedBody);
      const moreBlocked = secondaryButton('Load more blocked users');
      moreBlocked.hidden = true;
      blockedSection.append(moreBlocked);
      content.append(blockedSection);

      if (handlers.onLoadBlockedUsers) {
        let blockedOffset = 0;
        const loadBlocked = async (append = false): Promise<void> => {
          try {
            const page = await handlers.onLoadBlockedUsers!(blockedOffset);
            if (!append) blockedBody.replaceChildren();
            if (!append && page.items.length === 0) {
              blockedBody.append(paragraph('You have not blocked anyone.'));
            } else {
              for (const blockedUser of page.items) {
                const name = String(blockedUser.user_firstname || blockedUser.user_name || `User ${blockedUser.user_id}`);
                const row = element('div', 'settings-row');
                row.append(elementWithText('strong', name));
                if (blockedUser.user_name) row.append(elementWithText('span', `@${String(blockedUser.user_name)}`));
                blockedBody.append(row);
              }
            }
            moreBlocked.hidden = !page.hasMore;
          } catch (error) {
            if (!append) blockedBody.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load blocked users.'));
            else window.alert(error instanceof Error ? error.message : 'Unable to load more blocked users.');
          }
        };
        moreBlocked.addEventListener('click', () => { blockedOffset += 1; void loadBlocked(true); });
        await loadBlocked();
      } else {
        blockedBody.replaceChildren(paragraph('Blocked-user management is not available yet.'));
      }

      const danger = element('section', 'settings-card danger-card');
      danger.append(elementWithText('h3', 'Delete account'));
      danger.append(paragraph('Deleting your account is permanent. Enter your password to confirm.'));
      const deleteForm = document.createElement('form');
      deleteForm.className = 'delete-account-form';
      const password = input('password', 'Current password', 'deletePassword');
      password.autocomplete = 'current-password';
      const passwordControl = passwordField(password);
      const deleteButton = actionButton('Delete my account');
      deleteButton.type = 'submit';
      deleteButton.classList.add('danger-button');
      const deleteError = element('p', 'form-error');
      deleteError.hidden = true;
      deleteForm.append(passwordControl, deleteError, deleteButton);
      deleteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!handlers.onDeleteAccount || !password.value) return;
        const confirmed = window.confirm('Permanently delete your ChatPalez account? This cannot be undone.');
        if (!confirmed) return;
        deleteButton.disabled = true;
        deleteButton.textContent = 'Deleting…';
        deleteError.hidden = true;
        void handlers.onDeleteAccount(password.value).catch((error: unknown) => {
          deleteError.textContent = error instanceof Error ? error.message : 'Unable to delete account.';
          deleteError.hidden = false;
          deleteButton.disabled = false;
          deleteButton.textContent = 'Delete my account';
        });
      });
      danger.append(deleteForm);
      content.append(danger);
    }

    async function showNotifications(): Promise<void> {
      content.replaceChildren(screenTitle('Notifications'));
      if (!handlers.onLoadNotifications) {
        content.append(paragraph('Notifications are not wired yet.'));
        return;
      }
      content.append(paragraph('Loading notifications…'));
      try {
        const items = await handlers.onLoadNotifications();
        content.replaceChildren(screenTitle('Notifications'));
        if (items.length === 0) {
          content.append(paragraph('No notifications yet.'));
          return;
        }
        const list = element('div', 'notification-list');
        for (const item of items) {
          const button = element('button', 'notification-item');
          button.type = 'button';
          button.append(elementWithText('strong', String(item.name || 'ChatPalez')));
          button.append(elementWithText('span', String(item.message || 'Notification')));
          if (item.time) button.append(elementWithText('small', String(item.time)));
          if (item.url) {
            button.addEventListener('click', () => {
              const url = new URL(String(item.url), window.location.origin);
              const path = `${url.pathname}${url.search}${url.hash}`;
              handlers.onOpenWebModule(path);
            });
          } else {
            button.disabled = true;
          }
          list.append(button);
        }
        content.append(list);
      } catch (error) {
        content.replaceChildren(screenTitle('Notifications'));
        content.append(paragraph(error instanceof Error ? error.message : 'Unable to load notifications.'));
        const retry = secondaryButton('Try again');
        retry.addEventListener('click', () => void showNotifications());
        content.append(retry);
      }
    }

    async function showConversationList(): Promise<void> {
      content.replaceChildren();
      const headingRow = element('div', 'section-heading-row');
      headingRow.append(screenTitle('Chat'));
      if (handlers.onLoadContacts && handlers.onStartConversation) {
        const compose = secondaryButton('New chat');
        compose.classList.add('compact-button');
        compose.addEventListener('click', () => void showNewConversation());
        headingRow.append(compose);
      }
      content.append(headingRow);
      if (!handlers.onLoadConversations) {
        content.append(paragraph('Chat is not wired yet.'));
        return;
      }
      const list = element('div', 'conversation-list');
      content.append(paragraph('Loading conversations…'));
      let offset = 0;
      let hasMore = false;
      const load = async (append: boolean): Promise<void> => {
        try {
          const page = await handlers.onLoadConversations!(offset);
          const status = content.querySelector('p');
          status?.remove();
          if (!append) list.replaceChildren();
          for (const conversation of page.items) list.append(conversationList([conversation], (item) => void showConversation(item)).firstElementChild!);
          hasMore = page.hasMore;
          if (!append && page.items.length === 0) content.append(paragraph('No chats yet. Start a new chat.'));
          more.hidden = !hasMore;
        } catch (error) {
          content.append(paragraph(error instanceof Error ? error.message : 'Unable to load conversations.'));
        }
      };
      const more = secondaryButton('Load more');
      more.hidden = true;
      more.addEventListener('click', () => { offset += 1; void load(true); });
      content.append(list, more);
      await load(false);
    }

    async function showNewConversation(): Promise<void> {
      content.replaceChildren();
      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', () => void showConversationList());
      header.append(back, screenTitle('New chat'));
      content.append(header);

      const modeNote = paragraph('Select one person for a direct chat, or select multiple people to start a group conversation.');
      modeNote.className = 'conversation-help';
      content.append(modeNote);

      const selected = new Map<string, ChatContact>();
      const selectedWrap = element('div', 'selected-contact-chips');
      selectedWrap.hidden = true;
      content.append(selectedWrap);

      const searchForm = document.createElement('form');
      searchForm.className = 'contact-search';
      const query = input('search', 'Search contacts', 'contactSearch');
      query.required = false;
      const search = actionButton('Search');
      search.type = 'submit';
      searchForm.append(query, search);
      content.append(searchForm);

      const results = element('div', 'contact-list');
      content.append(results);

      const composer = document.createElement('form');
      composer.className = 'initial-message-form group-message-form';
      composer.hidden = true;
      const text = document.createElement('textarea');
      text.rows = 3;
      text.placeholder = 'Write the first message…';
      text.required = true;
      const send = actionButton('Start conversation');
      send.type = 'submit';
      composer.append(text, send);
      content.append(composer);

      let offset = 0;
      let hasMore = false;
      const more = secondaryButton('Load more contacts');
      more.hidden = true;
      results.after(more);

      const refreshSelected = (): void => {
        selectedWrap.replaceChildren();
        selectedWrap.hidden = selected.size === 0;
        composer.hidden = selected.size === 0;
        for (const [id, contact] of selected) {
          const chip = element('button', 'selected-contact-chip');
          chip.type = 'button';
          const name = String(contact.user_fullname || contact.user_firstname || contact.user_name || `User ${contact.user_id}`);
          chip.textContent = `${name} ×`;
          chip.addEventListener('click', () => {
            selected.delete(id);
            refreshSelected();
            void loadContacts();
          });
          selectedWrap.append(chip);
        }
        send.textContent = selected.size > 1 ? `Start group (${selected.size})` : 'Start conversation';
      };

      const loadContacts = async (append = false): Promise<void> => {
        if (!handlers.onLoadContacts) return;
        if (!append) results.replaceChildren(paragraph('Loading contacts…'));
        try {
          const page = await handlers.onLoadContacts(query.value.trim(), offset);
          if (!append) results.replaceChildren();
          if (!append && page.items.length === 0) {
            results.append(paragraph('No matching contacts.'));
          }
          hasMore = page.hasMore;
          more.hidden = !hasMore;

          for (const contact of page.items) {
            const id = String(contact.user_id);
            const row = element('button', 'contact-item selectable-contact');
            row.type = 'button';
            row.classList.toggle('is-selected', selected.has(id));

            if (contact.user_picture) {
              const avatar = document.createElement('img');
              avatar.className = 'contact-avatar';
              avatar.src = String(contact.user_picture);
              avatar.alt = '';
              avatar.loading = 'lazy';
              row.append(avatar);
            }

            const copy = element('span', 'contact-item__copy');
            const name = String(contact.user_fullname || contact.user_firstname || contact.user_name || `User ${contact.user_id}`);
            copy.append(elementWithText('strong', name));
            if (contact.user_name) copy.append(elementWithText('span', `@${String(contact.user_name)}`));
            copy.append(elementWithText('small', contact.user_is_online ? 'Online' : (contact.user_last_seen ? `Last seen ${String(contact.user_last_seen)}` : '')));
            row.append(copy);

            const marker = elementWithText('span', selected.has(id) ? '✓' : '+');
            marker.className = 'contact-select-marker';
            row.append(marker);

            row.addEventListener('click', () => {
              if (selected.has(id)) selected.delete(id);
              else selected.set(id, contact);
              refreshSelected();
              row.classList.toggle('is-selected', selected.has(id));
              marker.textContent = selected.has(id) ? '✓' : '+';
            });
            results.append(row);
          }
        } catch (error) {
          results.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load contacts.'));
        }
      };

      composer.addEventListener('submit', (event) => {
        event.preventDefault();
        const message = text.value.trim();
        const ids = [...selected.values()].map((contact) => contact.user_id);
        if (!message || ids.length === 0) return;
        const operation = ids.length === 1
          ? handlers.onStartConversation?.(ids[0], message)
          : handlers.onStartGroupConversation?.(ids, message);
        if (!operation) {
          window.alert(ids.length > 1 ? 'Group messaging is not available in this build.' : 'Messaging is not available in this build.');
          return;
        }
        send.disabled = true;
        send.textContent = 'Starting…';
        void operation
          .then((conversation) => showConversation(conversation))
          .catch((error: unknown) => {
            window.alert(error instanceof Error ? error.message : 'Unable to start conversation.');
            send.disabled = false;
            send.textContent = ids.length > 1 ? `Start group (${ids.length})` : 'Start conversation';
          });
      });

      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        offset = 0;
        void loadContacts();
      });
      more.addEventListener('click', () => {
        if (hasMore) {
          offset += 1;
          void loadContacts(true);
        }
      });
      await loadContacts();
    }

    async function showConversation(conversation: Conversation): Promise<void> {
      const conversationId = conversation.conversation_id;
      const titleText = String(conversation.name || conversation.name_list || 'Conversation');
      content.replaceChildren();
      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', () => void showConversationList());
      header.append(back, screenTitle(titleText));
      if (handlers.onLeaveConversation || handlers.onDeleteConversation) {
        const manage = secondaryButton('More');
        manage.classList.add('compact-button');
        manage.addEventListener('click', () => {
          const choice = window.prompt('Type LEAVE to leave this conversation, or DELETE to remove it from your inbox.');
          const action = choice?.trim().toLowerCase();
          const operation = action === 'delete'
            ? handlers.onDeleteConversation
            : action === 'leave'
              ? handlers.onLeaveConversation
              : null;
          if (!operation) return;
          manage.disabled = true;
          void operation(conversationId)
            .then(() => showConversationList())
            .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to update this conversation.'))
            .finally(() => { manage.disabled = false; });
        });
        header.append(manage);
      }
      content.append(header);
      const presence = element('p', 'conversation-presence');
      presence.textContent = conversation.multiple_recipients
        ? `${conversation.recipients?.length ?? 0} participants`
        : conversation.user_is_online
          ? 'Online'
          : '';
      content.append(presence);
      const loadOlder = secondaryButton('Load older messages');
      loadOlder.hidden = true;
      content.append(loadOlder);
      const thread = element('div', 'message-thread');
      thread.append(paragraph('Loading messages…'));
      content.append(thread);
      if (!handlers.onLoadMessages) {
        thread.replaceChildren(paragraph('Message loading is not wired yet.'));
        return;
      }
      const composer = document.createElement('form');
      composer.className = 'message-composer';
      const text = document.createElement('textarea');
      text.name = 'message';
      text.rows = 2;
      text.placeholder = 'Write a message…';
      text.setAttribute('aria-label', 'Message');
      const send = actionButton('Send');
      send.type = 'submit';
      const photo = document.createElement('input');
      photo.type = 'file';
      photo.accept = 'image/*';
      photo.setAttribute('aria-label', 'Attach photo');
      const attach = secondaryButton('Photo');
      attach.classList.add('compact-button', 'attach-button');
      attach.addEventListener('click', () => photo.click());
      photo.className = 'message-photo-input';
      photo.hidden = true;
      composer.append(attach, text, photo, send);
      content.append(composer);
      let typingTimer: number | undefined;

      const setTyping = (value: boolean): void => {
        if (!handlers.onTyping) return;
        void handlers.onTyping(conversationId, value).catch(() => undefined);
      };

      text.addEventListener('input', () => {
        setTyping(true);
        if (typingTimer) window.clearTimeout(typingTimer);
        typingTimer = window.setTimeout(() => setTyping(false), 1200);
      });
      text.addEventListener('blur', () => setTyping(false));

      let historyOffset = 0;

      const renderPresence = (result: MessagesResult): void => {
        presence.textContent = result.typing_name_list
          ? `${result.typing_name_list} typing…`
          : result.user_is_online
            ? 'Online'
            : result.user_last_seen
              ? `Last seen ${String(result.user_last_seen)}`
              : '';
      };

      const refreshThread = async (older = false): Promise<void> => {
        try {
          const nextOffset = older ? historyOffset + 1 : 0;
          const result = await handlers.onLoadMessages?.(conversationId, nextOffset);
          if (!result) return;
          const messages = result.messages ?? [];
          renderPresence(result);
          loadOlder.hidden = !result.has_more;
          if (!older) thread.replaceChildren();
          if (messages.length === 0) {
            if (!older) thread.append(paragraph('No messages yet.'));
            return;
          }
          const bubbles = messages.map((message) => messageBubble(message, session, handlers.resolveChatPhotoUrl, handlers.onReactToMessage, handlers.onDeleteMessage, () => refreshThread()));
          if (older) {
            const beforeHeight = thread.scrollHeight;
            const beforeTop = thread.scrollTop;
            thread.prepend(...bubbles);
            thread.scrollTop = thread.scrollHeight - beforeHeight + beforeTop;
          } else {
            thread.append(...bubbles);
          }
          historyOffset = nextOffset;
          const ids = messages
            .map((message) => message.message_id)
            .filter((id): id is number | string => id !== undefined && id !== null);
          if (ids.length > 0 && handlers.onMarkSeen) {
            void handlers.onMarkSeen(ids).catch(() => undefined);
          }
          if (!older) thread.scrollTop = thread.scrollHeight;
        } catch (error) {
          if (!older) thread.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load messages.'));
          else window.alert(error instanceof Error ? error.message : 'Unable to load older messages.');
        }
      };

      loadOlder.addEventListener('click', () => void refreshThread(true));

      composer.addEventListener('submit', (event) => {
        event.preventDefault();
        const message = text.value.trim();
        const selectedPhoto = photo.files?.[0];
        if ((!message && !selectedPhoto) || !handlers.onSendMessage) return;
        send.disabled = true;
        send.textContent = 'Sending…';
        setTyping(false);
        void handlers.onSendMessage(conversationId, message, selectedPhoto)
          .then(async () => {
            text.value = '';
            photo.value = '';
            await refreshThread();
          })
          .catch((error: unknown) => {
            window.alert(error instanceof Error ? error.message : 'Unable to send message.');
          })
          .finally(() => {
            send.disabled = false;
            send.textContent = 'Send';
          });
      });
      await refreshThread();
    }

    layout.append(topbar, content, nav);
    root.append(layout);
    void selectTab(initialTab);
  };

  const setBusy = (busy: boolean, message = 'Please wait…'): void => {
    root.toggleAttribute('aria-busy', busy);
    if (busy) root.dataset.busyMessage = message;
    else delete root.dataset.busyMessage;
  };
  retryAction = () => showLogin();
  const setRetryAction = (action: () => void): void => {
    retryAction = action;
  };
  return { showStartup, showLogin, showAuthenticated, setBusy, setRetryAction };
}

function conversationList(conversations: Conversation[], onOpen: (conversation: Conversation) => void): HTMLDivElement {
  const list = element('div', 'conversation-list');
  for (const conversation of conversations) {
    const item = element('button', 'conversation-item');
    item.type = 'button';

    const avatarWrap = element('span', 'conversation-avatar');
    if (conversation.picture) {
      const avatar = document.createElement('img');
      avatar.src = String(conversation.picture);
      avatar.alt = '';
      avatar.loading = 'lazy';
      avatarWrap.append(avatar);
    } else {
      avatarWrap.textContent = conversation.multiple_recipients ? 'G' : 'C';
    }

    const copy = element('span', 'conversation-item__copy');
    const name = String(conversation.name || conversation.name_list || 'Conversation');
    copy.append(elementWithText('strong', name));
    const lastMessage = String(conversation.last_message?.message || conversation.last_message?.text || '');
    const secondary = lastMessage || (conversation.multiple_recipients
      ? `${conversation.recipients?.length ?? 0} participants`
      : conversation.user_is_online ? 'Online' : 'Open conversation');
    copy.append(elementWithText('span', secondary));

    if (!conversation.seen) item.classList.add('is-unread');
    item.append(avatarWrap, copy);
    item.addEventListener('click', () => onOpen(conversation));
    list.append(item);
  }
  return list;
}

function messageBubble(message: Message, session: AuthSession, resolvePhotoUrl?: (source: string) => string | null, onReact?: (messageId: number | string, reaction: string) => Promise<void>, onDelete?: (messageId: number | string) => Promise<void>, onRefresh?: () => Promise<void>): HTMLDivElement {
  const bubble = element('div', 'message-bubble');
  const senderId = String(message.user_id ?? message.sender_id ?? '');
  if (senderId && senderId === String(session.user.user_id ?? '')) bubble.classList.add('is-mine');
  const body = String(message.message ?? '');
  if (body) bubble.append(elementWithText('div', body));
  const photoUrl = resolvePhotoUrl?.(message.photo ?? '');
  if (photoUrl) {
    const photo = document.createElement('img');
    photo.className = 'message-photo';
    photo.src = photoUrl;
    photo.alt = 'Shared photo';
    photo.loading = 'lazy';
    bubble.append(photo);
  }
  if (!body && !photoUrl) bubble.append(elementWithText('div', 'Attachment'));
  if (message.time) bubble.append(elementWithText('small', String(message.time)));
  if (message.message_id && onReact) {
    const like = secondaryButton('Like');
    like.classList.add('compact-button');
    like.addEventListener('click', () => {
      like.disabled = true;
      void onReact(message.message_id!, 'like').catch((error: unknown) => {
        window.alert(error instanceof Error ? error.message : 'Unable to react to this message.');
      }).finally(() => { like.disabled = false; });
    });
    bubble.append(like);
  }
  if (message.message_id && senderId && senderId === String(session.user.user_id ?? '') && onDelete) {
    const remove = secondaryButton('Delete');
    remove.classList.add('compact-button');
    remove.addEventListener('click', () => {
      if (!window.confirm('Delete this message?')) return;
      remove.disabled = true;
      void onDelete(message.message_id!)
        .then(() => onRefresh?.())
        .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to delete this message.'))
        .finally(() => { remove.disabled = false; });
    });
    bubble.append(remove);
  }
  return bubble;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
function elementWithText<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
  const node = element(tag);
  node.textContent = text;
  return node;
}
function heading(text: string): HTMLHeadingElement { return elementWithText('h1', text); }
function paragraph(text: string): HTMLParagraphElement { return elementWithText('p', text); }
function screenTitle(text: string): HTMLHeadingElement { const title = elementWithText('h2', text); title.className = 'screen-title'; return title; }
function brandMark(size?: 'small'): HTMLImageElement {
  const mark = document.createElement('img');
  mark.className = size === 'small' ? 'brand-mark brand-mark-small' : 'brand-mark';
  mark.src = '/brand/chatpalez-app-icon.png';
  mark.alt = '';
  mark.setAttribute('aria-hidden', 'true');
  return mark;
}
function actionButton(text: string): HTMLButtonElement { const button = elementWithText('button', text); button.type = 'button'; button.className = 'primary-button'; return button; }
function secondaryButton(text: string): HTMLButtonElement { const button = elementWithText('button', text); button.type = 'button'; button.className = 'secondary-button'; return button; }
function input(type: string, placeholder: string, name: string): HTMLInputElement { const node = document.createElement('input'); node.type = type; node.placeholder = placeholder; node.name = name; node.required = true; return node; }
function field(label: string, control: HTMLElement): HTMLLabelElement { const node = element('label', 'field'); node.append(elementWithText('span', label), control); return node; }

function passwordField(inputControl: HTMLInputElement): HTMLDivElement {
  const wrap = element('div', 'password-field');
  const toggle = element('button', 'password-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Show password');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.textContent = '👁';
  toggle.addEventListener('click', () => {
    const showing = inputControl.type === 'text';
    inputControl.type = showing ? 'password' : 'text';
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    toggle.setAttribute('aria-pressed', showing ? 'false' : 'true');
    inputControl.focus({ preventScroll: true });
  });
  wrap.append(inputControl, toggle);
  return wrap;
}

function policyLinks(openPublicPage: (path: string) => void): HTMLDivElement {
  const wrap = element('div', 'auth-policy-links');
  const items: Array<[string, string]> = [
    ['Privacy Policy', '/static/privacy'],
    ['Terms', '/static/terms'],
    ['Child Safety', '/static/childsafetypolicy']
  ];
  items.forEach(([label, path], index) => {
    if (index) wrap.append(elementWithText('span', '•'));
    const button = element('button', 'auth-policy-link');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => openPublicPage(path));
    wrap.append(button);
  });
  return wrap;
}
function initials(name: string): string { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'C'; }


function nativeNotificationStatusMessage(status: NativeNotificationStatus): string {
  switch (status) {
    case 'enabled':
      return 'Notifications are enabled for this device.';
    case 'disabled':
      return 'Notifications are currently disabled. You can enable them in your device settings.';
    case 'not-configured':
      return 'Notifications are not configured for this app build yet.';
    case 'unsupported':
      return 'Native notifications are available in the installed Android or iOS app.';
  }
}

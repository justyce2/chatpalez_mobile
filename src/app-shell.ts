import type { ChatContact, Conversation, Message, MessagesResult } from './api/chat';
import type { NotificationItem } from './api/notifications';
import type { FeedPost, FeedView } from './api/feed';
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
  onOpenWebModule: (path: string, target?: string) => void;
  onLoadFeed?: (view: FeedView, offset: number) => Promise<PageResult<FeedPost>>;
  resolveChatPhotoUrl?: (source: string) => string | null;
  onManageNotifications?: () => Promise<NativeNotificationStatus>;
  onLoadConversations?: (offset: number) => Promise<PageResult<Conversation>>;
  onLoadContacts?: (query: string, offset: number) => Promise<PageResult<ChatContact>>;
  onStartConversation?: (recipientId: number | string, message: string) => Promise<Conversation>;
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
  showAuthenticated: (session: AuthSession) => void;
  setBusy: (busy: boolean, message?: string) => void;
  setRetryAction: (action: () => void) => void;
  handleBack: () => boolean;
};

export function createAppShell(root: HTMLElement, handlers: AppShellHandlers): AppShell {
  let retryAction: (() => void) | null = null;
  let backAction: (() => void) | null = null;

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
    const errorBox = element('p', 'form-error');
    errorBox.hidden = !error;
    errorBox.textContent = error ?? '';
    const submit = actionButton('Sign in');
    submit.type = 'submit';
    form.append(field('Email or username', identity), field('Password', password), errorBox, submit);
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

  const showAuthenticated = (session: AuthSession): void => {
    root.replaceChildren();
    const user = session.user;
    const displayName = String(user.user_fullname || user.user_firstname || user.user_name || 'ChatPalez');
    const layout = element('section', 'mobile-layout');
    const drawer = element('aside', 'native-drawer');
    drawer.id = 'chatpalez-native-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    const drawerBackdrop = element('button', 'native-drawer-backdrop');
    drawerBackdrop.type = 'button';
    drawerBackdrop.setAttribute('aria-label', 'Close navigation');
    const drawerPanel = element('div', 'native-drawer-panel');

    const drawerHead = element('div', 'native-drawer-head');
    drawerHead.append(brandMark('small'), elementWithText('strong', 'ChatPalez'));
    const drawerClose = iconButton('header-menu', 'Close menu');
    drawerClose.addEventListener('click', closeDrawer);
    drawerHead.append(drawerClose);
    drawerPanel.append(drawerHead);

    const drawerItems: Array<{ label: string; icon: string; action: () => void }> = [
      { label: 'News Feed', icon: 'header-home', action: () => void showFeed('newsfeed') },
      { label: 'Popular Posts', icon: 'posts_discover', action: () => void showFeed('popular') },
      { label: 'Discover Posts', icon: 'posts_recent', action: () => void showFeed('discover') },
      { label: 'Saved', icon: 'saved', action: () => void showFeed('saved') },
      { label: 'Scheduled', icon: 'schedule', action: () => void showFeed('scheduled') },
      { label: 'Memories', icon: 'memories', action: () => void showFeed('memories') },
      { label: 'People', icon: 'friends', action: () => showRetainedModule('/people', 'People') },
      { label: 'Pages', icon: 'pages', action: () => showRetainedModule('/pages', 'Pages') },
      { label: 'Groups', icon: 'groups', action: () => showRetainedModule('/groups', 'Groups') },
      { label: 'Events', icon: 'events', action: () => showRetainedModule('/events', 'Events') },
      { label: 'Reels', icon: 'reels', action: () => showRetainedModule('/reels', 'Reels', 'reels') },
      { label: 'Watch', icon: 'watch', action: () => showRetainedModule('/watch', 'Watch') },
      { label: 'Blogs', icon: 'blogs', action: () => showRetainedModule('/blogs', 'Blogs') },
      { label: 'Market', icon: 'products', action: () => showRetainedModule('/market', 'Market') },
      { label: 'Funding', icon: 'funding', action: () => showRetainedModule('/funding', 'Funding') },
      { label: 'Offers', icon: 'offers', action: () => showRetainedModule('/offers', 'Offers') },
      { label: 'Jobs', icon: 'jobs', action: () => showRetainedModule('/jobs', 'Jobs') },
      { label: 'Courses', icon: 'courses', action: () => showRetainedModule('/courses', 'Courses') }
    ];

    const drawerList = element('div', 'native-drawer-list');
    for (const item of drawerItems) {
      const button = navigationButton(item.icon, item.label);
      button.addEventListener('click', () => {
        closeDrawer();
        item.action();
      });
      drawerList.append(button);
    }
    drawerPanel.append(drawerList);
    drawer.append(drawerBackdrop, drawerPanel);
    drawerBackdrop.addEventListener('click', closeDrawer);

    function openDrawer(): void {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      menu.setAttribute('aria-expanded', 'true');
      document.body.classList.add('native-drawer-open');
      window.setTimeout(() => {
        drawerPanel.querySelector<HTMLButtonElement>('button')?.focus();
      }, 0);
    }
    function closeDrawer(): void {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      menu.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('native-drawer-open');
    }

    drawer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        menu.focus();
      }
    });

    const topbar = element('header', 'mobile-topbar');
    const topLeft = element('div', 'native-topbar-left');
    const menu = iconButton('header-menu', 'Open navigation');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-controls', 'chatpalez-native-drawer');
    menu.addEventListener('click', openDrawer);
    const brand = element('button', 'topbar-brand');
    brand.type = 'button';
    brand.append(brandMark('small'));
    brand.addEventListener('click', () => void showFeed('newsfeed'));
    topLeft.append(menu, brand);

    const topActions = element('div', 'native-topbar-actions');
    const requests = iconButton('header-friends', 'Friend requests');
    requests.addEventListener('click', () => showRetainedModule('/people/friend_requests', 'Friend Requests'));
    const messages = iconButton('header-messages', 'Messages');
    messages.addEventListener('click', () => void showConversationList());
    const alerts = iconButton('header-notifications', 'Notifications');
    alerts.addEventListener('click', () => void showNotifications());
    topActions.append(requests, messages, alerts);
    topbar.append(topLeft, topActions);

    const content = element('main', 'mobile-content');

    const nav = element('nav', 'bottom-tabs');
    nav.setAttribute('aria-label', 'Primary');
    const bottomItems = [
      { id: 'home', label: 'Home', icon: 'header-home', action: () => void showFeed('newsfeed') },
      { id: 'reels', label: 'Reels', icon: 'reels', action: () => showRetainedModule('/reels', 'Reels', 'reels') },
      { id: 'add', label: 'Add', icon: 'header-plus', action: () => showQuickAdd() },
      { id: 'search', label: 'Search', icon: 'header-search', action: () => showRetainedModule('/search', 'Search', 'search') },
      { id: 'menu', label: 'Menu', icon: 'user_information', action: () => showAccountMenu() }
    ] as const;

    const buttons = new Map<string, HTMLButtonElement>();
    for (const tab of bottomItems) {
      const button = navigationButton(tab.icon, tab.label);
      button.classList.add('tab-button');
      button.dataset.tab = tab.id;
      button.addEventListener('click', tab.action);
      buttons.set(tab.id, button);
      nav.append(button);
    }

    function setActiveTab(id: string): void {
      for (const [tabId, button] of buttons) {
        const active = tabId === id;
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
    }

    function showRetainedModule(path: string, title: string, activeTab?: string): void {
      closeDrawer();
      backAction = () => { void showFeed('newsfeed'); };
      if (activeTab) setActiveTab(activeTab);
      else setActiveTab('');

      content.replaceChildren();
      const frameName = 'chatpalez-retained-module';
      const wrapper = element('section', 'retained-module');
      const header = element('div', 'retained-module-header');
      header.append(screenTitle(title));

      const close = iconButton('close', `Close ${title}`);
      close.classList.add('retained-module-close');
      close.addEventListener('click', () => void showFeed('newsfeed'));
      header.append(close);

      const loading = paragraph(`Opening ${title}…`);
      loading.className = 'retained-module-loading';

      const frame = document.createElement('iframe');
      frame.className = 'retained-module-frame';
      frame.name = frameName;
      frame.title = title;
      frame.setAttribute('allow', 'camera; microphone; autoplay; clipboard-write');
      frame.addEventListener('load', () => {
        loading.hidden = true;
        frame.classList.add('is-ready');
      });

      wrapper.append(header, loading, frame);
      content.append(wrapper);
      handlers.onOpenWebModule(path, frameName);
    }

    function showQuickAdd(): void {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('add');
      content.replaceChildren(screenTitle('Create'));
      const grid = element('div', 'quick-add-grid');
      const actions = [
        ['newsfeed', 'Post', '/'],
        ['live', 'Live', '/live'],
        ['24_hours', 'Story', '/'],
        ['blogs', 'Blog', '/blogs/new'],
        ['products', 'Product', '/market'],
        ['funding', 'Funding', '/funding'],
        ['ads', 'Ads', '/ads/new'],
        ['pages', 'Page', '/pages'],
        ['groups', 'Group', '/groups'],
        ['events', 'Event', '/events']
      ] as const;
      for (const [icon, label, route] of actions) {
        const button = navigationButton(icon, label);
        button.classList.add('quick-add-item');
        button.addEventListener('click', () => showRetainedModule(route, label));
        grid.append(button);
      }
      content.append(grid);
    }

    async function showFeed(view: FeedView = 'newsfeed'): Promise<void> {
      backAction = view === 'newsfeed' ? null : () => { void showFeed('newsfeed'); };
      setActiveTab('home');
      content.replaceChildren();
      const headingRow = element('div', 'section-heading-row');
      const titles: Record<FeedView, string> = {
        newsfeed: 'News Feed',
        popular: 'Popular Posts',
        discover: 'Discover Posts',
        saved: 'Saved',
        scheduled: 'Scheduled',
        memories: 'Memories'
      };
      headingRow.append(screenTitle(titles[view]));
      content.append(headingRow);

      if (!handlers.onLoadFeed) {
        content.append(paragraph('This feed is not available through the mobile API yet.'));
        return;
      }

      const list = element('div', 'native-feed');
      list.append(paragraph('Loading feed…'));
      content.append(list);
      let offset = 0;
      let hasMore = false;
      const more = secondaryButton('Load more');
      more.hidden = true;
      content.append(more);

      const load = async (append = false): Promise<void> => {
        try {
          const page = await handlers.onLoadFeed!(view, offset);
          if (!append) list.replaceChildren();
          if (!append && page.items.length === 0) {
            list.append(paragraph('Nothing to show yet.'));
          } else {
            for (const post of page.items) list.append(feedCard(post, handlers.onOpenWebModule));
          }
          hasMore = page.hasMore;
          more.hidden = !hasMore;
        } catch (error) {
          if (!append) list.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load feed.'));
          else window.alert(error instanceof Error ? error.message : 'Unable to load more posts.');
        }
      };
      more.addEventListener('click', () => {
        if (!hasMore) return;
        offset += 1;
        void load(true);
      });
      await load();
    }

    function showAccountMenu(): void {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('menu');
      content.replaceChildren();

      const accountHead = element('section', 'account-menu-head');
      const accountAvatar = element('div', 'account-menu-avatar');
      accountAvatar.textContent = displayName.trim().slice(0, 1).toUpperCase() || 'C';
      const identity = element('div', 'account-menu-identity');
      identity.append(elementWithText('strong', displayName));
      if (user.user_name) identity.append(elementWithText('span', `@${String(user.user_name)}`));
      accountHead.append(accountAvatar, identity);
      content.append(accountHead);

      const sections: Array<Array<{ icon: string; label: string; action: () => void }>> = [
        [
          { icon: 'user_information', label: 'View profile', action: showProfile },
          { icon: 'settings', label: 'Account & settings', action: () => void showSettings() },
          { icon: 'saved', label: 'Saved', action: () => void showFeed('saved') },
          { icon: 'notifications', label: 'Notifications', action: () => void showNotifications() }
        ],
        [
          { icon: 'privacy', label: 'Privacy Policy', action: () => showRetainedModule('/static/privacy', 'Privacy Policy') },
          { icon: 'privacy', label: 'Terms & Conditions', action: () => showRetainedModule('/static/terms', 'Terms & Conditions') },
          { icon: 'security', label: 'Child Safety', action: () => showRetainedModule('/static/child-safety', 'Child Safety') },
          { icon: 'delete', label: 'Account deletion help', action: () => showRetainedModule('/account-deletion.php', 'Account Deletion') }
        ]
      ];

      for (const group of sections) {
        const section = element('section', 'account-menu-section');
        for (const item of group) {
          const button = navigationButton(item.icon, item.label);
          button.classList.add('account-menu-item');
          button.addEventListener('click', item.action);
          section.append(button);
        }
        content.append(section);
      }

      const logout = navigationButton('logout', 'Sign out');
      logout.classList.add('account-menu-item', 'account-menu-logout');
      logout.addEventListener('click', () => void handlers.onLogout());
      const logoutSection = element('section', 'account-menu-section');
      logoutSection.append(logout);
      content.append(logoutSection);
    }

    function showProfile(): void {
      backAction = showAccountMenu;
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
      backAction = showAccountMenu;
      content.replaceChildren();
      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', showAccountMenu);
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
      const deleteButton = actionButton('Delete my account');
      deleteButton.type = 'submit';
      deleteButton.classList.add('danger-button');
      const deleteError = element('p', 'form-error');
      deleteError.hidden = true;
      deleteForm.append(password, deleteError, deleteButton);
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
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('');
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
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('');
      content.replaceChildren();
      const headingRow = element('div', 'section-heading-row');
      headingRow.append(screenTitle('Messages'));
      if (handlers.onLoadContacts && handlers.onStartConversation) {
        const compose = secondaryButton('New message');
        compose.classList.add('compact-button');
        compose.addEventListener('click', () => void showNewConversation());
        headingRow.append(compose);
      }
      content.append(headingRow);
      if (!handlers.onLoadConversations) {
        content.append(paragraph('Messaging is not wired yet.'));
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
          if (!append && page.items.length === 0) content.append(paragraph('No conversations yet. Start a new message.'));
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
      backAction = () => { void showConversationList(); };
      content.replaceChildren();
      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', () => void showConversationList());
      header.append(back, screenTitle('New message'));
      content.append(header);

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

      let offset = 0;
      let hasMore = false;
      const more = secondaryButton('Load more contacts');
      more.hidden = true;
      results.after(more);

      const loadContacts = async (append = false): Promise<void> => {
        if (!handlers.onLoadContacts) return;
        if (!append) results.replaceChildren(paragraph('Loading contacts…'));
        try {
          const page = await handlers.onLoadContacts(query.value.trim(), offset);
          const contacts = page.items;
          if (!append) results.replaceChildren();
          if (!append && contacts.length === 0) {
            results.append(paragraph('No matching contacts.'));
            more.hidden = !page.hasMore;
            return;
          }
          hasMore = page.hasMore;
          more.hidden = !hasMore;
          for (const contact of contacts) {
            const button = element('button', 'contact-item');
            button.type = 'button';
            const name = String(contact.user_fullname || contact.user_firstname || contact.user_name || `User ${contact.user_id}`);
            button.append(elementWithText('strong', name));
            if (contact.user_name) button.append(elementWithText('span', `@${String(contact.user_name)}`));
            if (contact.user_is_online) button.append(elementWithText('small', 'Online'));
            button.addEventListener('click', () => showInitialComposer(contact));
            results.append(button);
          }
        } catch (error) {
          results.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load contacts.'));
        }
      };

      const showInitialComposer = (contact: ChatContact): void => {
        const name = String(contact.user_fullname || contact.user_firstname || contact.user_name || 'Contact');
        results.replaceChildren();
        const selected = element('div', 'selected-contact');
        selected.append(elementWithText('strong', name));
        if (contact.user_name) selected.append(elementWithText('span', `@${String(contact.user_name)}`));
        results.append(selected);
        const form = document.createElement('form');
        form.className = 'initial-message-form';
        const text = document.createElement('textarea');
        text.rows = 3;
        text.placeholder = `Message ${name}…`;
        text.required = true;
        const send = actionButton('Send message');
        send.type = 'submit';
        form.append(text, send);
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const message = text.value.trim();
          if (!message || !handlers.onStartConversation) return;
          send.disabled = true;
          send.textContent = 'Sending…';
          void handlers.onStartConversation(contact.user_id, message)
            .then((conversation) => showConversation(conversation))
            .catch((error: unknown) => {
              window.alert(error instanceof Error ? error.message : 'Unable to start conversation.');
              send.disabled = false;
              send.textContent = 'Send message';
            });
        });
        results.append(form);
      };

      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        offset = 0;
        void loadContacts();
      });
      more.addEventListener('click', () => { if (hasMore) { offset += 1; void loadContacts(true); } });
      await loadContacts();
    }

    async function showConversation(conversation: Conversation): Promise<void> {
      backAction = () => { void showConversationList(); };
      const conversationId = conversation.conversation_id;
      const titleText = String(conversation.name || conversation.name_list || 'Conversation');
      content.replaceChildren();
      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', () => void showConversationList());
      header.append(back, screenTitle(titleText));
      if (handlers.onLeaveConversation || handlers.onDeleteConversation) {
        const manage = secondaryButton('Manage');
        manage.classList.add('compact-button');
        manage.addEventListener('click', () => {
          const deleteConversation = window.confirm('Delete this conversation from your inbox?');
          const operation = deleteConversation ? handlers.onDeleteConversation : handlers.onLeaveConversation;
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
      presence.textContent = conversation.user_is_online ? 'Online' : '';
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
      composer.append(text, photo, send);
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

    layout.append(topbar, content, nav, drawer);
    root.append(layout);
    void showFeed('newsfeed');
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
  const handleBack = (): boolean => {
    const openDrawer = root.querySelector<HTMLElement>('.native-drawer.is-open');
    if (openDrawer) {
      openDrawer.classList.remove('is-open');
      openDrawer.setAttribute('aria-hidden', 'true');
      root.querySelector<HTMLButtonElement>('[aria-controls="chatpalez-native-drawer"]')?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('native-drawer-open');
      return true;
    }
    if (!backAction) return false;
    const action = backAction;
    backAction = null;
    action();
    return true;
  };
  return { showStartup, showLogin, showAuthenticated, setBusy, setRetryAction, handleBack };
}

function iconAsset(icon: string): string {
  return `https://chatpalez.com/content/themes/default/images/svg/${icon}.svg`;
}

function iconButton(icon: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'native-icon-button';
  button.setAttribute('aria-label', label);
  const img = document.createElement('img');
  img.src = iconAsset(icon);
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  button.append(img);
  return button;
}

function navigationButton(icon: string, label: string): HTMLButtonElement {
  const button = iconButton(icon, label);
  button.classList.add('native-navigation-button');
  const title = elementWithText('span', label);
  title.className = 'native-navigation-label';
  button.append(title);
  return button;
}

function feedCard(post: FeedPost, openWebModule: (path: string) => void): HTMLElement {
  const card = element('article', 'native-post-card');
  const header = element('div', 'native-post-header');
  if (post.author_picture) {
    const avatar = document.createElement('img');
    avatar.className = 'native-post-avatar';
    avatar.src = post.author_picture;
    avatar.alt = '';
    header.append(avatar);
  }
  const identity = element('div', 'native-post-identity');
  identity.append(elementWithText('strong', post.author_name || post.author_username || 'ChatPalez'));
  if (post.time) identity.append(elementWithText('small', post.time));
  header.append(identity);
  card.append(header);

  if (post.text) {
    const body = elementWithText('div', post.text);
    body.className = 'native-post-text';
    card.append(body);
  }

  if (post.photos?.length) {
    const media = element('div', post.photos.length > 1 ? 'native-post-media native-post-media-grid' : 'native-post-media');
    for (const photo of post.photos.slice(0, 4)) {
      const img = document.createElement('img');
      img.src = photo.source;
      img.alt = 'Post image';
      img.loading = 'lazy';
      media.append(img);
    }
    card.append(media);
  } else if (post.reel?.thumbnail || post.video?.thumbnail) {
    const media = element('div', 'native-post-media');
    const img = document.createElement('img');
    img.src = String(post.reel?.thumbnail || post.video?.thumbnail);
    img.alt = 'Post media';
    img.loading = 'lazy';
    media.append(img);
    card.append(media);
  }

  if (post.link?.title || post.link?.url) {
    const preview = element('div', 'native-link-preview');
    if (post.link.image) {
      const img = document.createElement('img');
      img.src = post.link.image;
      img.alt = '';
      preview.append(img);
    }
    const info = element('div', 'native-link-preview-body');
    if (post.link.host) info.append(elementWithText('small', post.link.host));
    if (post.link.title) info.append(elementWithText('strong', post.link.title));
    if (post.link.description) info.append(elementWithText('span', post.link.description));
    preview.append(info);
    card.append(preview);
  }

  const stats = element('div', 'native-post-stats');
  const reactions = Number(post.reaction_like_count || 0) + Number(post.reaction_love_count || 0) +
    Number(post.reaction_haha_count || 0) + Number(post.reaction_yay_count || 0) +
    Number(post.reaction_wow_count || 0) + Number(post.reaction_sad_count || 0) +
    Number(post.reaction_angry_count || 0);
  stats.append(
    elementWithText('span', `${reactions} reactions`),
    elementWithText('span', `${post.comments || 0} comments`),
    elementWithText('span', `${post.shares || 0} shares`)
  );
  card.append(stats);

  const actions = element('div', 'native-post-actions');
  const open = secondaryButton('Open post');
  open.classList.add('native-post-action');
  open.addEventListener('click', () => {
    const route = post.url ? new URL(post.url).pathname : `/posts/${post.post_id}`;
    openWebModule(route);
  });
  actions.append(open);
  card.append(actions);
  return card;
}

function conversationList(conversations: Conversation[], onOpen: (conversation: Conversation) => void): HTMLDivElement {
  const list = element('div', 'conversation-list');
  for (const conversation of conversations) {
    const item = element('button', 'conversation-item');
    item.type = 'button';
    const name = String(conversation.name || conversation.name_list || 'Conversation');
    item.append(elementWithText('strong', name), elementWithText('span', conversation.user_is_online ? 'Online' : 'Open conversation'));
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
function field(label: string, control: HTMLInputElement): HTMLLabelElement { const node = element('label', 'field'); node.append(elementWithText('span', label), control); return node; }


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

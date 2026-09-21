import type { ChatContact, Conversation, Message, MessagesResult } from './api/chat';
import type { CommunityCreatePayload, CommunityCreationMeta, CommunityDetail, CreationCustomField, MobileEvent, MobileGroup, MobilePage, MobilePerson, MobileSearchResult } from './api/community';
import type { NotificationItem } from './api/notifications';
import type { FeedPost, FeedView, PostComment, ReelItem, VideoItem } from './api/feed';
import type { BlockedUser, MobileAccount, ProfileUpdate } from './api/user';
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
  trustedWebOrigin?: string;
  onLoadFeed?: (view: FeedView, offset: number) => Promise<PageResult<FeedPost>>;
  onLoadPost?: (postId: number | string) => Promise<FeedPost>;
  onLoadPostComments?: (postId: number | string, offset: number) => Promise<PageResult<PostComment>>;
  onReactToPost?: (postId: number | string, reaction: string, remove: boolean) => Promise<void>;
  onCommentOnPost?: (postId: number | string, message: string) => Promise<PostComment>;
  onReactToComment?: (commentId: number | string, reaction: string, remove: boolean) => Promise<void>;
  onEditComment?: (commentId: number | string, message: string) => Promise<void>;
  onDeleteComment?: (commentId: number | string) => Promise<void>;
  onCreatePost?: (message: string, privacy: 'me' | 'friends' | 'public') => Promise<FeedPost>;
  onLoadReels?: (offset: number) => Promise<PageResult<ReelItem>>;
  onLoadWatch?: (offset: number) => Promise<PageResult<VideoItem>>;
  onLoadPages?: (view: 'discover' | 'liked' | 'manage', offset: number) => Promise<PageResult<MobilePage>>;
  onLoadGroups?: (view: 'discover' | 'joined' | 'manage', offset: number) => Promise<PageResult<MobileGroup>>;
  onLoadEvents?: (view: 'discover' | 'going' | 'interested' | 'invited' | 'manage', offset: number) => Promise<PageResult<MobileEvent>>;
  onLoadPeople?: (view: 'discover' | 'requests' | 'sent' | 'friends', offset: number) => Promise<PageResult<MobilePerson>>;
  onSearch?: (query: string) => Promise<MobileSearchResult[]>;
  onLoadCommunityDetail?: (type: 'page' | 'group' | 'event', id: number | string) => Promise<CommunityDetail>;
  onLoadCreationMeta?: (type: 'page' | 'group' | 'event') => Promise<CommunityCreationMeta>;
  onCreatePage?: (payload: CommunityCreatePayload) => Promise<MobilePage>;
  onCreateGroup?: (payload: CommunityCreatePayload) => Promise<MobileGroup>;
  onCreateEvent?: (payload: CommunityCreatePayload) => Promise<MobileEvent>;
  onConnect?: (action: string, id: number | string) => Promise<void>;
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
  onLoadAccount?: () => Promise<MobileAccount>;
  onUpdateProfile?: (payload: ProfileUpdate) => Promise<void>;
  onUpdateIdentity?: (payload: { username: string; email: string; phone: string; password: string }) => Promise<void>;
  onUpdateWork?: (payload: { work_title: string; work_place: string; work_url: string }) => Promise<void>;
  onUpdateLocation?: (payload: { city: string; hometown: string }) => Promise<void>;
  onUpdateEducation?: (payload: { edu_major: string; edu_school: string; edu_class: string }) => Promise<void>;
  onUpdateSocial?: (payload: { facebook: string; twitter: string; youtube: string; instagram: string; twitch: string; linkedin: string; vkontakte: string }) => Promise<void>;
  onUpdatePassword?: (payload: { current: string; new: string; confirm: string }) => Promise<void>;
  onUpdatePrivacy?: (payload: Record<string, string | boolean>) => Promise<void>;
  onUploadProfilePicture?: (file: File) => Promise<MobileAccount>;
  onDeleteProfilePicture?: () => Promise<MobileAccount>;
  onDeleteAccount?: (password: string) => Promise<void>;
};

export type AppShell = {
  showStartup: (title: string, message: string, canRetry?: boolean) => void;
  showLogin: (error?: string) => void;
  showAuthenticated: (session: AuthSession) => void;
  setBusy: (busy: boolean, message?: string) => void;
  setRetryAction: (action: () => void) => void;
  handleBack: () => boolean;
  openRoute: (path: string) => boolean;
};

export function createAppShell(root: HTMLElement, handlers: AppShellHandlers): AppShell {
  let retryAction: (() => void) | null = null;
  let backAction: (() => void) | null = null;
  let authenticatedCleanup: (() => void) | null = null;
  let routeAction: ((path: string) => void) | null = null;

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
    routeAction = null;
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
    authenticatedCleanup?.();
    authenticatedCleanup = null;
    root.replaceChildren();
    const user = session.user;
    let displayName = String(user.user_fullname || user.user_firstname || user.user_name || 'ChatPalez');
    let cachedAccount: MobileAccount | null = null;

    async function loadAccountSnapshot(force = false): Promise<MobileAccount> {
      if (!handlers.onLoadAccount) throw new Error('Native account details are not available yet.');
      if (!force && cachedAccount) return cachedAccount;
      const account = await handlers.onLoadAccount();
      cachedAccount = account;
      displayName = account.fullname || [account.firstname, account.lastname].filter(Boolean).join(' ') || account.username || displayName;
      if (account.username) user.user_name = account.username;
      if (account.email) user.user_email = account.email;
      if (account.firstname) user.user_firstname = account.firstname;
      if (account.lastname) user.user_lastname = account.lastname;
      user.user_fullname = displayName;
      return account;
    }

    function invalidateAccountSnapshot(): void {
      cachedAccount = null;
    }
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
      { label: 'People', icon: 'friends', action: () => void showPeople('discover') },
      { label: 'Pages', icon: 'pages', action: () => void showPages('discover') },
      { label: 'Groups', icon: 'groups', action: () => void showGroups('discover') },
      { label: 'Events', icon: 'events', action: () => void showEvents('discover') },
      { label: 'Reels', icon: 'reels', action: () => void showReels() },
      { label: 'Watch', icon: 'watch', action: () => void showWatch() },
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
    requests.addEventListener('click', () => void showPeople('requests'));
    const messages = iconButton('header-messages', 'Messages');
    messages.addEventListener('click', () => void showConversationList());
    const alerts = iconButton('header-notifications', 'Notifications');
    alerts.addEventListener('click', () => void showNotifications());
    topActions.append(requests, messages, alerts);
    topbar.append(topLeft, topActions);

    const content = element('main', 'mobile-content');
    let retainedFrameName: string | null = null;
    let retainedHistory: string[] = [];
    let retainedTitle = '';

    const retainedMessageListener = (event: MessageEvent): void => {
      if (!handlers.trustedWebOrigin || event.origin !== handlers.trustedWebOrigin) return;
      if (!event.data || typeof event.data !== 'object') return;
      const payload = event.data as { source?: string; type?: string; path?: string; title?: string };
      if (payload.source !== 'chatpalez-retained' || payload.type !== 'ready') return;
      if (!retainedFrameName || !payload.path || payload.path[0] !== '/') return;

      const current = retainedHistory[retainedHistory.length - 1];
      if (current !== payload.path) retainedHistory.push(payload.path);
      retainedTitle = payload.title || retainedTitle;

      backAction = () => {
        if (!retainedFrameName) {
          void showFeed('newsfeed');
          return;
        }
        if (retainedHistory.length > 1) {
          retainedHistory.pop();
          const previous = retainedHistory[retainedHistory.length - 1];
          handlers.onOpenWebModule(previous, retainedFrameName);
          return;
        }
        retainedFrameName = null;
        retainedHistory = [];
        void showFeed('newsfeed');
      };
    };
    window.addEventListener('message', retainedMessageListener);
    authenticatedCleanup = () => window.removeEventListener('message', retainedMessageListener);

    const nav = element('nav', 'bottom-tabs');
    nav.setAttribute('aria-label', 'Primary');
    const bottomItems = [
      { id: 'home', label: 'Home', icon: 'header-home', action: () => void showFeed('newsfeed') },
      { id: 'reels', label: 'Reels', icon: 'reels', action: () => void showReels() },
      { id: 'add', label: 'Add', icon: 'header-plus', action: () => showQuickAdd() },
      { id: 'search', label: 'Search', icon: 'header-search', action: () => showSearch() },
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

    function dispatchRoute(rawPath: string): void {
      const url = new URL(rawPath || '/', handlers.trustedWebOrigin || 'https://chatpalez.com');
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (path === '/' || path === '/index') {
        void showFeed('newsfeed');
        return;
      }
      if (path === '/reels') {
        void showReels();
        return;
      }
      if (path === '/watch') {
        void showWatch();
        return;
      }
      if (path === '/search') {
        showSearch();
        return;
      }
      if (path === '/people') {
        void showPeople('discover');
        return;
      }
      if (path === '/people/friend_requests') {
        void showPeople('requests');
        return;
      }
      if (path === '/pages') {
        void showPages('discover');
        return;
      }
      if (path === '/groups') {
        void showGroups('discover');
        return;
      }
      if (path === '/events') {
        void showEvents('discover');
        return;
      }
      if (path === '/notifications') {
        void showNotifications();
        return;
      }
      if (path === '/messages' || path === '/chat') {
        void showConversationList();
        return;
      }
      if (path === '/settings') {
        void showSettings();
        return;
      }

      const postMatch = path.match(/^\/posts\/(\d+)$/);
      if (postMatch) {
        void showPostDetail(postMatch[1]);
        return;
      }

      const eventMatch = path.match(/^\/events\/(\d+)$/);
      if (eventMatch) {
        void showCommunityDetail('event', eventMatch[1]);
        return;
      }

      showRetainedModule(`${path}${url.search}${url.hash}`, document.title || 'ChatPalez');
    }

    routeAction = dispatchRoute;

    function showRetainedModule(path: string, title: string, activeTab?: string): void {
      closeDrawer();
      if (activeTab) setActiveTab(activeTab);
      else setActiveTab('');

      content.replaceChildren();
      const frameName = 'chatpalez-retained-module';
      retainedFrameName = frameName;
      retainedHistory = [path];
      retainedTitle = title;
      backAction = () => {
        retainedFrameName = null;
        retainedHistory = [];
        void showFeed('newsfeed');
      };
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
      frame.addEventListener('error', () => {
        loading.hidden = false;
        loading.textContent = `Unable to open ${retainedTitle || title}. Check your connection and try again.`;
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
        if (label === 'Post') {
          button.addEventListener('click', showPostComposer);
        } else if (label === 'Page') {
          button.addEventListener('click', () => void showCommunityCreator('page'));
        } else if (label === 'Group') {
          button.addEventListener('click', () => void showCommunityCreator('group'));
        } else if (label === 'Event') {
          button.addEventListener('click', () => void showCommunityCreator('event'));
        } else {
          button.addEventListener('click', () => showRetainedModule(route, label));
        }
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
            for (const post of page.items) list.append(feedCard(post, (postId) => { void showPostDetail(postId); }));
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

    function showSearch(): void {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('search');
      content.replaceChildren();

      const form = document.createElement('form');
      form.className = 'native-search-form';
      const query = input('search', 'Search ChatPalez', 'globalSearch');
      query.required = false;
      query.autocomplete = 'off';
      const submit = actionButton('Search');
      submit.type = 'submit';
      form.append(query, submit);

      const results = element('div', 'native-search-results');
      results.append(paragraph('Search people, pages, groups and events.'));
      content.append(form, results);

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const term = query.value.trim();
        if (term.length < 2) {
          results.replaceChildren(paragraph('Enter at least two characters.'));
          return;
        }
        if (!handlers.onSearch) {
          results.replaceChildren(paragraph('Search is not available through the mobile API yet.'));
          return;
        }

        submit.disabled = true;
        results.replaceChildren(paragraph('Searching…'));
        void handlers.onSearch(term)
          .then((items) => {
            results.replaceChildren();
            if (items.length === 0) {
              results.append(paragraph('No results found.'));
              return;
            }
            for (const item of items) results.append(searchResultCard(item));
          })
          .catch((error: unknown) => {
            results.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to search.'));
          })
          .finally(() => { submit.disabled = false; });
      });

      window.setTimeout(() => query.focus(), 0);
    }

    function searchResultCard(item: MobileSearchResult): HTMLElement {
      const button = element('button', 'native-search-result');
      button.type = 'button';

      if (item.picture) {
        const image = document.createElement('img');
        image.src = item.picture;
        image.alt = '';
        image.loading = 'lazy';
        button.append(image);
      }

      const body = element('div', 'native-search-result-body');
      body.append(elementWithText('strong', item.title || item.user_fullname || item.user_name || 'ChatPalez'));
      if (item.subtitle) body.append(elementWithText('span', item.subtitle));
      body.append(elementWithText('small', item.type));
      button.append(body);

      button.addEventListener('click', () => {
        const route = item.url || (item.type === 'user' && item.user_name ? `/${item.user_name}` : '/');
        showRetainedModule(route, item.title || item.user_fullname || 'Result', 'search');
      });
      return button;
    }

    async function showPeople(view: 'discover' | 'requests' | 'sent' | 'friends' = 'discover'): Promise<void> {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('');
      content.replaceChildren();

      const tabs = localTabs([
        ['Discover', () => void showPeople('discover'), view === 'discover'],
        ['Requests', () => void showPeople('requests'), view === 'requests'],
        ['Sent', () => void showPeople('sent'), view === 'sent'],
        ['Friends', () => void showPeople('friends'), view === 'friends']
      ]);

      content.append(screenTitle(view === 'requests' ? 'Friend Requests' : 'People'), tabs);
      await renderPagedCommunity<MobilePerson>(
        handlers.onLoadPeople ? (offset) => handlers.onLoadPeople!(view, offset) : undefined,
        (person) => personCard(person, view)
      );
    }

    function personCard(person: MobilePerson, view: 'discover' | 'requests' | 'sent' | 'friends'): HTMLElement {
      const name = person.user_fullname || person.user_name || 'ChatPalez member';
      const card = communityCard(
        person.user_picture,
        name,
        person.mutual_friends_count ? `${person.mutual_friends_count} mutual friends` : (person.user_name ? `@${person.user_name}` : '')
      );

      if (handlers.onConnect) {
        if (view === 'requests') {
          const accept = secondaryButton('Accept');
          accept.classList.add('community-card-action');
          accept.addEventListener('click', () => runPersonAction(accept, 'friend-accept', person.user_id, 'Accepted'));
          card.append(accept);

          const decline = secondaryButton('Decline');
          decline.classList.add('community-card-action');
          decline.addEventListener('click', () => runPersonAction(decline, 'friend-decline', person.user_id, 'Declined'));
          card.append(decline);
        } else if (view === 'sent') {
          const cancel = secondaryButton('Cancel request');
          cancel.classList.add('community-card-action');
          cancel.addEventListener('click', () => runPersonAction(cancel, 'friend-cancel', person.user_id, 'Cancelled'));
          card.append(cancel);
        } else if (view === 'discover') {
          const add = secondaryButton('Add friend');
          add.classList.add('community-card-action');
          add.addEventListener('click', () => runPersonAction(add, 'friend-add', person.user_id, 'Request sent'));
          card.append(add);
        } else if (view === 'friends') {
          const remove = secondaryButton('Remove friend');
          remove.classList.add('community-card-action');
          remove.addEventListener('click', () => runPersonAction(remove, 'friend-remove', person.user_id, 'Removed'));
          card.append(remove);
        }
      }

      const profile = secondaryButton('Profile');
      profile.classList.add('community-card-action');
      profile.addEventListener('click', () => showRetainedModule(person.url || `/${person.user_name || ''}`, name));
      card.append(profile);
      return card;
    }

    function runPersonAction(button: HTMLButtonElement, action: string, userId: number | string, doneLabel: string): void {
      if (!handlers.onConnect) return;
      button.disabled = true;
      void handlers.onConnect(action, userId)
        .then(() => { button.textContent = doneLabel; })
        .catch((error: unknown) => {
          window.alert(error instanceof Error ? error.message : 'Unable to update this connection.');
          button.disabled = false;
        });
    }

    async function showCommunityCreator(type: 'page' | 'group' | 'event'): Promise<void> {
      backAction = showQuickAdd;
      setActiveTab('add');
      content.replaceChildren();

      const title = type === 'page' ? 'Create page' : type === 'group' ? 'Create group' : 'Create event';
      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', showQuickAdd);
      header.append(back, screenTitle(title));
      content.append(header);

      if (!handlers.onLoadCreationMeta) {
        showRetainedModule(type === 'page' ? '/pages' : type === 'group' ? '/groups' : '/events', title);
        return;
      }

      const host = element('section', 'native-create-card');
      host.append(paragraph('Loading creation options…'));
      content.append(host);

      try {
        const meta = await handlers.onLoadCreationMeta(type);
        if (!meta.allowed) {
          host.replaceChildren(paragraph(`Your current account or plan cannot create a ${type}.`));
          return;
        }
        if (!meta.supports_native) {
          showRetainedModule(type === 'page' ? '/pages' : type === 'group' ? '/groups' : '/events', title);
          return;
        }

        host.replaceChildren();
        const form = element('form', 'native-settings-form') as HTMLFormElement;
        const name = settingsInput(type === 'page' ? 'Page name' : type === 'group' ? 'Group name' : 'Event name', 'text', '');
        form.append(name.wrapper);

        let username: ReturnType<typeof settingsInput> | null = null;
        if (type !== 'event') {
          username = settingsInput(type === 'page' ? 'Page username' : 'Group username', 'text', '');
          form.append(username.wrapper);
        }

        let start: ReturnType<typeof settingsInput> | null = null;
        let end: ReturnType<typeof settingsInput> | null = null;
        let eventType: ReturnType<typeof settingsSelect> | null = null;
        let location: ReturnType<typeof settingsInput> | null = null;
        if (type === 'event') {
          start = settingsInput('Start date', 'datetime-local', '');
          end = settingsInput('End date', 'datetime-local', '');
          eventType = settingsSelect('Event type', [['0', 'In person'], ['1', 'Online']], '0');
          location = settingsInput('Location', 'text', '');
          form.append(start.wrapper, end.wrapper, eventType.wrapper, location.wrapper);
          eventType.control.addEventListener('change', () => {
            if (location) location.control.disabled = eventType?.control.value === '1';
          });
        }

        let privacy: ReturnType<typeof settingsSelect> | null = null;
        if (type === 'group' || type === 'event') {
          privacy = settingsSelect('Privacy', [
            ['public', 'Public'],
            ['closed', 'Closed'],
            ['secret', 'Secret']
          ], 'public');
          form.append(privacy.wrapper);
        }

        const category = settingsSelect(
          'Category',
          [['', 'Select category'], ...meta.categories.map((item) => [String(item.id), item.label] as [string, string])],
          ''
        );
        const country = settingsSelect(
          'Country',
          [['', 'Select country'], ...meta.countries.map((item) => [String(item.id), item.label] as [string, string])],
          meta.fallback_country != null ? String(meta.fallback_country) : ''
        );
        const language = settingsSelect(
          'Language',
          [['', 'Select language'], ...meta.languages.map((item) => [String(item.id), item.label] as [string, string])],
          meta.fallback_language != null ? String(meta.fallback_language) : ''
        );
        const description = settingsTextarea('About', '', 4);
        form.append(category.wrapper, country.wrapper, language.wrapper, description.wrapper);

        const customControls = new Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
        for (const custom of meta.custom_fields) {
          const rendered = creationCustomField(custom);
          customControls.set(String(custom.id), rendered.control);
          form.append(rendered.wrapper);
        }

        let createPost: ReturnType<typeof settingsCheckbox> | null = null;
        if (type === 'group' || type === 'event') {
          createPost = settingsCheckbox('Create an announcement post after creation', false);
          form.append(createPost.wrapper);
        }

        const status = element('p', 'settings-form-status');
        const submit = actionButton(type === 'page' ? 'Create page' : type === 'group' ? 'Create group' : 'Create event');
        submit.type = 'submit';
        form.append(status, submit);

        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const custom_fields: Record<string, string | string[]> = {};
          for (const custom of meta.custom_fields) {
            const control = customControls.get(String(custom.id));
            if (!control) continue;
            if (custom.type === 'multipleselectbox' && control instanceof HTMLSelectElement) {
              custom_fields[String(custom.id)] = Array.from(control.selectedOptions).map((option) => option.value);
            } else {
              custom_fields[String(custom.id)] = control.value;
            }
          }

          const payload: CommunityCreatePayload = {
            title: name.control.value.trim(),
            category: category.control.value,
            country: country.control.value,
            language: language.control.value,
            description: description.control.value.trim(),
            custom_fields
          };

          if (username) payload.username = username.control.value.trim();
          if (privacy) payload.privacy = privacy.control.value as 'public' | 'closed' | 'secret';
          if (createPost) payload.create_post = createPost.control.checked;

          if (type === 'event') {
            payload.start_date = start?.control.value || '';
            payload.end_date = end?.control.value || '';
            payload.is_online = eventType?.control.value === '1';
            payload.location = payload.is_online ? '' : (location?.control.value.trim() || '');
            payload.latitude = '';
            payload.longitude = '';
          }

          submit.disabled = true;
          status.textContent = 'Creating…';

          const operation = type === 'page'
            ? handlers.onCreatePage?.(payload)
            : type === 'group'
              ? handlers.onCreateGroup?.(payload)
              : handlers.onCreateEvent?.(payload);

          if (!operation) {
            submit.disabled = false;
            status.textContent = 'Native creation is not available in this build.';
            return;
          }

          void operation.then((created) => {
            if (type === 'page') {
              const page = created as MobilePage;
              void showCommunityDetail('page', page.page_id);
            } else if (type === 'group') {
              const group = created as MobileGroup;
              void showCommunityDetail('group', group.group_id);
            } else {
              const eventItem = created as MobileEvent;
              void showCommunityDetail('event', eventItem.event_id);
            }
          }).catch((error: unknown) => {
            status.textContent = error instanceof Error ? error.message : `Unable to create ${type}.`;
            submit.disabled = false;
          });
        });

        host.append(form);
      } catch (error) {
        host.replaceChildren(paragraph(error instanceof Error ? error.message : `Unable to prepare ${type} creation.`));
      }
    }

    function creationCustomField(custom: CreationCustomField): {
      wrapper: HTMLLabelElement;
      control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    } {
      if (custom.type === 'textarea') {
        const item = settingsTextarea(custom.label, '', 3);
        item.control.required = Boolean(custom.mandatory);
        if (custom.length) item.control.maxLength = custom.length;
        return item;
      }

      if (custom.type === 'selectbox' || custom.type === 'multipleselectbox') {
        const item = settingsSelect(
          custom.label,
          [['none', 'Select option'], ...(custom.options || []).map((label, index) => [String(index), label] as [string, string])],
          'none'
        );
        item.control.required = Boolean(custom.mandatory);
        if (custom.type === 'multipleselectbox') {
          item.control.multiple = true;
          item.control.size = Math.min(Math.max((custom.options || []).length, 2), 5);
          item.control.querySelector('option[value="none"]')?.remove();
        }
        return item;
      }

      const item = settingsInput(custom.label, 'text', '');
      item.control.required = Boolean(custom.mandatory);
      if (custom.length) item.control.maxLength = custom.length;
      return item;
    }

    function showPostComposer(): void {
      backAction = showQuickAdd;
      setActiveTab('add');
      content.replaceChildren();

      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', showQuickAdd);
      header.append(back, screenTitle('Create post'));
      content.append(header);

      if (!handlers.onCreatePost) {
        content.append(paragraph('Native post creation is not available yet.'));
        return;
      }

      const form = document.createElement('form');
      form.className = 'native-post-composer';

      const message = document.createElement('textarea');
      message.rows = 6;
      message.placeholder = 'What’s on your mind?';
      message.required = true;
      message.setAttribute('aria-label', 'Post text');

      const privacyField = document.createElement('label');
      privacyField.className = 'field';
      privacyField.append(elementWithText('span', 'Who can see this?'));
      const privacy = document.createElement('select');
      for (const [value, label] of [
        ['public', 'Public'],
        ['friends', 'Friends'],
        ['me', 'Only me']
      ] as const) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        privacy.append(option);
      }
      privacyField.append(privacy);

      const error = element('p', 'form-error');
      error.hidden = true;
      const submit = actionButton('Post');
      submit.type = 'submit';

      form.append(message, privacyField, error, submit);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = message.value.trim();
        if (!text) return;

        error.hidden = true;
        submit.disabled = true;
        submit.textContent = 'Posting…';

        void handlers.onCreatePost!(
          text,
          privacy.value as 'me' | 'friends' | 'public'
        ).then((post) => {
          void showPostDetail(post.post_id);
        }).catch((reason: unknown) => {
          error.textContent = reason instanceof Error ? reason.message : 'Unable to publish post.';
          error.hidden = false;
        }).finally(() => {
          submit.disabled = false;
          submit.textContent = 'Post';
        });
      });

      content.append(form);
      window.setTimeout(() => message.focus(), 0);
    }

    async function showPostDetail(postId: number | string): Promise<void> {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('');
      content.replaceChildren();

      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', () => void showFeed('newsfeed'));
      header.append(back, screenTitle('Post'));
      content.append(header);

      if (!handlers.onLoadPost) {
        content.append(paragraph('Post detail is not available through the mobile API yet.'));
        return;
      }

      const body = element('div', 'native-post-detail');
      body.append(paragraph('Loading post…'));
      content.append(body);

      try {
        const post = await handlers.onLoadPost(postId);
        body.replaceChildren();

        const card = feedCard(post);
        const mediaSource = post.reel?.source || post.video?.source;
        if (mediaSource) {
          card.querySelector('.native-post-media')?.remove();
          const player = document.createElement('video');
          player.className = 'native-post-player';
          player.controls = true;
          player.playsInline = true;
          player.preload = 'metadata';
          player.src = mediaSource;
          const poster = post.reel?.thumbnail || post.video?.thumbnail;
          if (poster) player.poster = poster;
          card.insertBefore(player, card.querySelector('.native-post-stats'));
        }

        const controls = element('div', 'native-post-detail-actions');
        if (handlers.onReactToPost) {
          const like = secondaryButton(post.i_react ? 'Unlike' : 'Like');
          like.classList.add('native-post-action');
          like.addEventListener('click', () => {
            const remove = Boolean(post.i_react);
            const reaction = post.i_reaction || 'like';
            like.disabled = true;
            void handlers.onReactToPost!(post.post_id, reaction, remove)
              .then(() => {
                post.i_react = !remove;
                post.i_reaction = post.i_react ? reaction : null;
                like.textContent = post.i_react ? 'Unlike' : 'Like';
              })
              .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to react to this post.'))
              .finally(() => { like.disabled = false; });
          });
          controls.append(like);
        }
        body.append(card, controls);

        const commentsSection = element('section', 'native-comments');
        commentsSection.append(elementWithText('h3', 'Comments'));
        const commentsList = element('div', 'native-comments-list');
        commentsSection.append(commentsList);

        let commentOffset = 0;
        let commentHasMore = false;
        const moreComments = secondaryButton('Load more comments');
        moreComments.hidden = true;
        commentsSection.append(moreComments);

        const loadComments = async (append = false): Promise<void> => {
          if (!handlers.onLoadPostComments) {
            if (!append) commentsList.replaceChildren(paragraph('Comments are not available through the mobile API yet.'));
            return;
          }
          try {
            const page = await handlers.onLoadPostComments(post.post_id, commentOffset);
            if (!append) commentsList.replaceChildren();
            if (!append && page.items.length === 0) commentsList.append(paragraph('No comments yet.'));
            for (const item of page.items) commentsList.append(commentCard(item, handlers, () => loadComments()));
            commentHasMore = page.hasMore;
            moreComments.hidden = !commentHasMore;
          } catch (error) {
            if (!append) commentsList.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load comments.'));
          }
        };

        moreComments.addEventListener('click', () => {
          if (!commentHasMore) return;
          commentOffset += 1;
          void loadComments(true);
        });

        if (!post.comments_disabled && handlers.onCommentOnPost) {
          const form = document.createElement('form');
          form.className = 'native-comment-form';
          const inputBox = document.createElement('textarea');
          inputBox.rows = 2;
          inputBox.placeholder = 'Write a comment…';
          inputBox.required = true;
          const submit = actionButton('Post');
          submit.type = 'submit';
          form.append(inputBox, submit);
          form.addEventListener('submit', (event) => {
            event.preventDefault();
            const message = inputBox.value.trim();
            if (!message) return;
            submit.disabled = true;
            void handlers.onCommentOnPost!(post.post_id, message)
              .then((comment) => {
                const empty = commentsList.querySelector('p');
                if (empty && commentsList.children.length === 1) commentsList.replaceChildren();
                commentsList.prepend(commentCard(comment, handlers, () => loadComments()));
                inputBox.value = '';
              })
              .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to post comment.'))
              .finally(() => { submit.disabled = false; });
          });
          commentsSection.append(form);
        } else if (post.comments_disabled) {
          commentsSection.append(paragraph('Comments are disabled for this post.'));
        }

        body.append(commentsSection);
        await loadComments();
      } catch (error) {
        body.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load post.'));
      }
    }

    async function showWatch(): Promise<void> {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('');
      content.replaceChildren(screenTitle('Watch'));

      const list = element('div', 'native-watch');
      const loading = paragraph('Loading videos…');
      list.append(loading);
      content.append(list);

      if (!handlers.onLoadWatch) {
        loading.textContent = 'Watch is not available through the mobile API yet.';
        return;
      }

      let offset = 0;
      let hasMore = false;
      const more = secondaryButton('Load more videos');
      more.hidden = true;
      content.append(more);

      const load = async (append = false): Promise<void> => {
        try {
          const page = await handlers.onLoadWatch!(offset);
          if (!append) list.replaceChildren();
          if (!append && page.items.length === 0) list.append(paragraph('No videos to show yet.'));
          for (const item of page.items) list.append(videoCard(item));
          hasMore = page.hasMore;
          more.hidden = !hasMore;
        } catch (error) {
          if (!append) list.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load videos.'));
          else window.alert(error instanceof Error ? error.message : 'Unable to load more videos.');
        }
      };

      more.addEventListener('click', () => {
        if (!hasMore) return;
        offset += 1;
        void load(true);
      });

      await load();
    }

    function videoCard(item: VideoItem): HTMLElement {
      const card = element('article', 'native-video-card');
      const media = element('button', 'native-video-media');
      media.type = 'button';
      media.setAttribute('aria-label', 'Open video');

      if (item.thumbnail) {
        const image = document.createElement('img');
        image.src = item.thumbnail;
        image.alt = '';
        image.loading = 'lazy';
        media.append(image);
      } else {
        media.append(elementWithText('span', 'Video'));
      }

      const play = elementWithText('span', '▶');
      play.className = 'native-video-play';
      media.append(play);
      media.addEventListener('click', () => void showPostDetail(item.post_id));

      const body = element('div', 'native-video-body');
      const identity = element('div', 'native-video-identity');
      if (item.author_picture) {
        const avatar = document.createElement('img');
        avatar.src = item.author_picture;
        avatar.alt = '';
        identity.append(avatar);
      }
      identity.append(elementWithText('strong', item.author_name || item.author_username || 'ChatPalez'));
      body.append(identity);
      if (item.text) body.append(elementWithText('p', item.text));
      const stats = element('div', 'native-video-stats');
      stats.append(
        elementWithText('span', `${item.reaction_like_count || 0} likes`),
        elementWithText('span', `${item.comments || 0} comments`),
        elementWithText('span', `${item.shares || 0} shares`)
      );
      body.append(stats);
      card.append(media, body);
      return card;
    }

    async function showReels(): Promise<void> {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('reels');
      content.replaceChildren(screenTitle('Reels'));

      const list = element('div', 'native-reels');
      const loading = paragraph('Loading reels…');
      list.append(loading);
      content.append(list);

      if (!handlers.onLoadReels) {
        loading.textContent = 'Reels are not available through the mobile API yet.';
        return;
      }

      let offset = 0;
      let hasMore = false;
      const more = secondaryButton('Load more reels');
      more.hidden = true;
      content.append(more);

      const load = async (append = false): Promise<void> => {
        try {
          const page = await handlers.onLoadReels!(offset);
          if (!append) list.replaceChildren();
          if (!append && page.items.length === 0) list.append(paragraph('No reels to show yet.'));
          for (const item of page.items) list.append(reelCard(item));
          hasMore = page.hasMore;
          more.hidden = !hasMore;
        } catch (error) {
          if (!append) list.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load reels.'));
          else window.alert(error instanceof Error ? error.message : 'Unable to load more reels.');
        }
      };

      more.addEventListener('click', () => {
        if (!hasMore) return;
        offset += 1;
        void load(true);
      });

      await load();
    }

    function reelCard(item: ReelItem): HTMLElement {
      const card = element('article', 'native-reel-card');
      const media = element('button', 'native-reel-media');
      media.type = 'button';
      media.setAttribute('aria-label', 'Open reel');

      if (item.thumbnail) {
        const image = document.createElement('img');
        image.src = item.thumbnail;
        image.alt = '';
        image.loading = 'lazy';
        media.append(image);
      } else {
        media.append(elementWithText('span', 'Reel'));
      }

      const play = elementWithText('span', '▶');
      play.className = 'native-reel-play';
      media.append(play);
      media.addEventListener('click', () => void showPostDetail(item.post_id));

      const body = element('div', 'native-reel-body');
      const identity = element('div', 'native-reel-identity');
      if (item.author_picture) {
        const avatar = document.createElement('img');
        avatar.src = item.author_picture;
        avatar.alt = '';
        identity.append(avatar);
      }
      identity.append(elementWithText('strong', item.author_name || item.author_username || 'ChatPalez'));
      body.append(identity);
      if (item.text) body.append(elementWithText('p', item.text));
      const stats = element('div', 'native-reel-stats');
      stats.append(
        elementWithText('span', `${item.reaction_like_count || 0} likes`),
        elementWithText('span', `${item.comments || 0} comments`),
        elementWithText('span', `${item.shares || 0} shares`)
      );
      body.append(stats);
      card.append(media, body);
      return card;
    }

    async function showPages(view: 'discover' | 'liked' | 'manage' = 'discover'): Promise<void> {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('');
      content.replaceChildren();

      const tabs = localTabs([
        ['Discover', () => void showPages('discover'), view === 'discover'],
        ['Liked', () => void showPages('liked'), view === 'liked'],
        ['My Pages', () => void showPages('manage'), view === 'manage']
      ]);
      content.append(screenTitle('Pages'), tabs);
      await renderPagedCommunity<MobilePage>(
        handlers.onLoadPages ? (offset) => handlers.onLoadPages!(view, offset) : undefined,
        (item) => pageCard(item)
      );
    }

    async function showGroups(view: 'discover' | 'joined' | 'manage' = 'discover'): Promise<void> {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('');
      content.replaceChildren();

      const tabs = localTabs([
        ['Discover', () => void showGroups('discover'), view === 'discover'],
        ['Joined', () => void showGroups('joined'), view === 'joined'],
        ['My Groups', () => void showGroups('manage'), view === 'manage']
      ]);
      content.append(screenTitle('Groups'), tabs);
      await renderPagedCommunity<MobileGroup>(
        handlers.onLoadGroups ? (offset) => handlers.onLoadGroups!(view, offset) : undefined,
        (item) => groupCard(item)
      );
    }

    async function showEvents(view: 'discover' | 'going' | 'interested' | 'invited' | 'manage' = 'discover'): Promise<void> {
      backAction = () => { void showFeed('newsfeed'); };
      setActiveTab('');
      content.replaceChildren();

      const tabs = localTabs([
        ['Discover', () => void showEvents('discover'), view === 'discover'],
        ['Going', () => void showEvents('going'), view === 'going'],
        ['Interested', () => void showEvents('interested'), view === 'interested'],
        ['Invited', () => void showEvents('invited'), view === 'invited'],
        ['My Events', () => void showEvents('manage'), view === 'manage']
      ]);
      content.append(screenTitle('Events'), tabs);
      await renderPagedCommunity<MobileEvent>(
        handlers.onLoadEvents ? (offset) => handlers.onLoadEvents!(view, offset) : undefined,
        (item) => eventCard(item)
      );
    }

    async function renderPagedCommunity<T>(
      loader: ((offset: number) => Promise<PageResult<T>>) | undefined,
      render: (item: T) => HTMLElement
    ): Promise<void> {
      const list = element('div', 'community-grid');
      const loading = paragraph('Loading…');
      list.append(loading);
      content.append(list);

      if (!loader) {
        loading.textContent = 'This section is not available through the mobile API yet.';
        return;
      }

      let offset = 0;
      let hasMore = false;
      const more = secondaryButton('Load more');
      more.hidden = true;
      content.append(more);

      const load = async (append = false): Promise<void> => {
        try {
          const page = await loader(offset);
          if (!append) list.replaceChildren();
          if (!append && page.items.length === 0) list.append(paragraph('Nothing to show yet.'));
          for (const item of page.items) list.append(render(item));
          hasMore = page.hasMore;
          more.hidden = !hasMore;
        } catch (error) {
          if (!append) list.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load this section.'));
          else window.alert(error instanceof Error ? error.message : 'Unable to load more.');
        }
      };

      more.addEventListener('click', () => {
        if (!hasMore) return;
        offset += 1;
        void load(true);
      });

      await load();
    }

    function pageCard(item: MobilePage): HTMLElement {
      const card = communityCard(item.page_picture, item.page_title, `${item.page_likes || 0} likes`);
      const open = secondaryButton('Open');
      open.classList.add('community-card-action');
      open.addEventListener('click', () => { void showCommunityDetail('page', item.page_id); });

      if (handlers.onConnect) {
        const like = secondaryButton(item.i_like ? 'Unlike' : 'Like');
        like.classList.add('community-card-action');
        like.addEventListener('click', () => {
          like.disabled = true;
          void handlers.onConnect!(item.i_like ? 'page-unlike' : 'page-like', item.page_id)
            .then(() => {
              item.i_like = !item.i_like;
              item.page_likes = Math.max(0, Number(item.page_likes || 0) + (item.i_like ? 1 : -1));
              like.textContent = item.i_like ? 'Unlike' : 'Like';
            })
            .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to update page.'))
            .finally(() => { like.disabled = false; });
        });
        card.append(like);
      }
      card.append(open);
      return card;
    }

    function groupCard(item: MobileGroup): HTMLElement {
      const card = communityCard(item.group_picture, item.group_title, `${item.group_members || 0} members`);
      const open = secondaryButton('Open');
      open.classList.add('community-card-action');
      open.addEventListener('click', () => { void showCommunityDetail('group', item.group_id); });

      if (handlers.onConnect) {
        const join = secondaryButton(item.i_joined === 'pending' ? 'Pending' : item.i_joined === 'approved' ? 'Joined' : 'Join');
        join.classList.add('community-card-action');
        join.addEventListener('click', () => {
          const joined = item.i_joined === 'approved' || item.i_joined === 'pending';
          join.disabled = true;
          void handlers.onConnect!(joined ? 'group-leave' : 'group-join', item.group_id)
            .then(() => {
              item.i_joined = joined ? false : (item.group_privacy === 'public' ? 'approved' : 'pending');
              join.textContent = item.i_joined === 'pending' ? 'Pending' : item.i_joined ? 'Joined' : 'Join';
            })
            .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to update group membership.'))
            .finally(() => { join.disabled = false; });
        });
        card.append(join);
      }
      card.append(open);
      return card;
    }

    function eventCard(item: MobileEvent): HTMLElement {
      const card = communityCard(item.event_picture, item.event_title, `${item.event_interested || 0} interested`);
      const open = secondaryButton('Open');
      open.classList.add('community-card-action');
      open.addEventListener('click', () => { void showCommunityDetail('event', item.event_id); });

      if (handlers.onConnect) {
        const interest = secondaryButton(item.i_joined?.is_interested ? 'Interested' : 'Interested?');
        interest.classList.add('community-card-action');
        interest.addEventListener('click', () => {
          const interested = Boolean(item.i_joined?.is_interested);
          interest.disabled = true;
          void handlers.onConnect!(interested ? 'event-uninterest' : 'event-interest', item.event_id)
            .then(() => {
              if (!item.i_joined) item.i_joined = {};
              item.i_joined.is_interested = !interested;
              item.event_interested = Math.max(0, Number(item.event_interested || 0) + (!interested ? 1 : -1));
              interest.textContent = !interested ? 'Interested' : 'Interested?';
            })
            .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to update event interest.'))
            .finally(() => { interest.disabled = false; });
        });
        card.append(interest);
      }
      card.append(open);
      return card;
    }

    async function showCommunityDetail(type: 'page' | 'group' | 'event', id: number | string): Promise<void> {
      backAction = () => {
        if (type === 'page') void showPages('discover');
        else if (type === 'group') void showGroups('discover');
        else void showEvents('discover');
      };
      setActiveTab('');
      content.replaceChildren();

      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', () => {
        if (type === 'page') void showPages('discover');
        else if (type === 'group') void showGroups('discover');
        else void showEvents('discover');
      });
      header.append(back, screenTitle(type === 'page' ? 'Page' : type === 'group' ? 'Group' : 'Event'));
      content.append(header);

      const body = element('div', 'community-detail');
      body.append(paragraph('Loading…'));
      content.append(body);

      if (!handlers.onLoadCommunityDetail) {
        body.replaceChildren(paragraph('This detail is not available through the mobile API yet.'));
        return;
      }

      try {
        const detail = await handlers.onLoadCommunityDetail(type, id);
        body.replaceChildren();

        const hero = element('section', 'community-detail-hero');
        if (detail.cover) {
          const cover = document.createElement('img');
          cover.className = 'community-detail-cover';
          cover.src = detail.cover;
          cover.alt = '';
          hero.append(cover);
        }

        const identity = element('div', 'community-detail-identity');
        if (detail.picture) {
          const picture = document.createElement('img');
          picture.className = 'community-detail-picture';
          picture.src = detail.picture;
          picture.alt = detail.title;
          identity.append(picture);
        }
        const text = element('div', 'community-detail-text');
        text.append(elementWithText('h2', detail.title));
        if (detail.members_label) text.append(elementWithText('span', detail.members_label));
        if (detail.description) text.append(elementWithText('p', detail.description));
        identity.append(text);
        hero.append(identity);

        const actions = element('div', 'community-detail-actions');
        if (handlers.onConnect) {
          if (type === 'page') {
            const liked = detail.relationship === 'liked';
            const button = secondaryButton(liked ? 'Unlike' : 'Like');
            button.addEventListener('click', () => {
              const currentLiked = button.textContent === 'Unlike';
              button.disabled = true;
              void handlers.onConnect!(currentLiked ? 'page-unlike' : 'page-like', detail.id)
                .then(() => { button.textContent = currentLiked ? 'Like' : 'Unlike'; })
                .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to update page.'))
                .finally(() => { button.disabled = false; });
            });
            actions.append(button);
          }

          if (type === 'group') {
            const relationship = String(detail.relationship || 'none');
            const button = secondaryButton(relationship === 'pending' ? 'Pending' : relationship === 'approved' ? 'Joined' : 'Join');
            button.addEventListener('click', () => {
              const joined = button.textContent === 'Joined' || button.textContent === 'Pending';
              button.disabled = true;
              void handlers.onConnect!(joined ? 'group-leave' : 'group-join', detail.id)
                .then(() => {
                  if (joined) button.textContent = 'Join';
                  else button.textContent = detail.privacy === 'public' ? 'Joined' : 'Pending';
                })
                .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to update group membership.'))
                .finally(() => { button.disabled = false; });
            });
            actions.append(button);
          }

          if (type === 'event') {
            const relation = detail.relationship && typeof detail.relationship === 'object'
              ? detail.relationship as Record<string, unknown>
              : {};
            const interested = Boolean(relation.is_interested);
            const button = secondaryButton(interested ? 'Interested' : 'Interested?');
            button.addEventListener('click', () => {
              const current = button.textContent === 'Interested';
              button.disabled = true;
              void handlers.onConnect!(current ? 'event-uninterest' : 'event-interest', detail.id)
                .then(() => { button.textContent = current ? 'Interested?' : 'Interested'; })
                .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to update event interest.'))
                .finally(() => { button.disabled = false; });
            });
            actions.append(button);
          }
        }
        if (actions.childElementCount > 0) hero.append(actions);
        body.append(hero);

        const postsSection = element('section', 'community-detail-posts');
        postsSection.append(elementWithText('h3', 'Posts'));

        if (detail.can_view_posts === false) {
          postsSection.append(paragraph('Join this community to view its posts.'));
        } else if (!detail.posts?.length) {
          postsSection.append(paragraph('No posts to show yet.'));
        } else {
          const list = element('div', 'native-feed');
          for (const post of detail.posts) {
            list.append(feedCard(post, (postId) => { void showPostDetail(postId); }));
          }
          postsSection.append(list);
        }

        body.append(postsSection);
      } catch (error) {
        body.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load this community.'));
      }
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

      const appendMenuSection = (items: Array<{ icon: string; label: string; action: () => void }>, extraClass?: string): HTMLElement => {
        const section = element('section', 'account-menu-section');
        if (extraClass) section.classList.add(extraClass);
        for (const item of items) {
          const button = navigationButton(item.icon, item.label);
          button.classList.add('account-menu-item');
          button.addEventListener('click', item.action);
          section.append(button);
        }
        content.append(section);
        return section;
      };

      appendMenuSection([
        { icon: 'user_information', label: 'View profile', action: () => { void showProfile(); } },
        { icon: 'settings', label: 'Account & settings', action: () => { void showSettings(); } },
        { icon: 'saved', label: 'Saved', action: () => { void showFeed('saved'); } },
        { icon: 'notifications', label: 'Notifications', action: () => { void showNotifications(); } }
      ]);

      const enabledServices = element('section', 'account-menu-section');
      enabledServices.append(paragraph('Loading account options…'));
      content.append(enabledServices);

      if (handlers.onLoadAccount) {
        void loadAccountSnapshot().then((details) => {
          enabledServices.replaceChildren();
          const menu = details.menu || {};

          if (details.picture) {
            accountAvatar.textContent = '';
            const img = document.createElement('img');
            img.src = details.picture;
            img.alt = '';
            accountAvatar.append(img);
          }
          identity.replaceChildren(elementWithText('strong', details.fullname || displayName));
          if (details.username) identity.append(elementWithText('span', `@${details.username}`));

          const add = (icon: string, label: string, route: string): void => {
            const button = navigationButton(icon, label);
            button.classList.add('account-menu-item');
            button.addEventListener('click', () => dispatchRoute(route));
            enabledServices.append(button);
          };

          if (menu.switch_accounts_enabled) {
            add('accounts_switcher', 'Switch Accounts', '/settings');
          }
          if (menu.packages_enabled && !menu.user_subscribed) {
            add('membership', 'Upgrade to Pro', '/packages');
          }
          if (menu.points_enabled) {
            add('points', `Points: ${menu.points ?? 0}`, '/settings/points');
          }
          if (menu.wallet_enabled) {
            add('wallet', menu.wallet_balance ? `Wallet: ${menu.wallet_balance}` : 'Wallet', '/wallet');
          }
          if (menu.support_center_enabled) {
            add('support', 'Support Center', '/support');
          }
          if (menu.is_admin) {
            add('admin_panel', 'Admin Panel', '/admincp');
          } else if (menu.is_moderator) {
            add('admin_panel', 'Moderator Panel', '/modcp');
          }
          if ((menu.themes_count || 0) > 1) {
            add('themes_switcher', 'Theme Switcher', '/settings');
          }
          if (menu.theme_mode_select) {
            add('dark_light', menu.theme_mode_night ? 'Day Mode' : 'Night Mode', '/settings');
          }

          if (enabledServices.childElementCount === 0) enabledServices.remove();
        }).catch(() => {
          enabledServices.remove();
        });
      } else {
        enabledServices.remove();
      }

      appendMenuSection([
        { icon: 'privacy', label: 'Privacy Policy', action: () => showRetainedModule('/static/privacy', 'Privacy Policy') },
        { icon: 'privacy', label: 'Terms & Conditions', action: () => showRetainedModule('/static/terms', 'Terms & Conditions') },
        { icon: 'security', label: 'Child Safety', action: () => showRetainedModule('/static/child-safety', 'Child Safety') },
        { icon: 'delete', label: 'Account deletion help', action: () => showRetainedModule('/account-deletion.php', 'Account Deletion') }
      ], 'account-menu-legal');

      appendMenuSection([
        { icon: 'logout', label: 'Sign out', action: () => { void handlers.onLogout(); } }
      ], 'account-menu-logout-section');
    }

    async function showProfile(): Promise<void> {
      backAction = showAccountMenu;
      setActiveTab('menu');
      content.replaceChildren(screenTitle('Profile'));

      const card = element('section', 'native-profile-card');
      card.append(paragraph('Loading profile…'));
      content.append(card);

      if (!handlers.onLoadAccount) {
        card.replaceChildren(paragraph('Profile details are not available through the mobile API yet.'));
        return;
      }

      try {
        const account = await loadAccountSnapshot();
        card.replaceChildren();

        const media = element('div', 'native-profile-media');
        if (account.picture) {
          const picture = document.createElement('img');
          picture.className = 'native-profile-picture';
          picture.src = account.picture;
          picture.alt = account.fullname || displayName;
          media.append(picture);
        }

        if (handlers.onUploadProfilePicture) {
          const picker = document.createElement('input');
          picker.type = 'file';
          picker.accept = 'image/*';
          picker.className = 'native-profile-file';
          picker.setAttribute('aria-label', 'Choose profile picture');

          const choose = secondaryButton(account.picture ? 'Change photo' : 'Add photo');
          choose.classList.add('compact-button');
          choose.addEventListener('click', () => picker.click());

          picker.addEventListener('change', () => {
            const file = picker.files?.[0];
            if (!file) return;
            choose.disabled = true;
            choose.textContent = 'Uploading…';
            void handlers.onUploadProfilePicture!(file)
              .then((updated) => {
                cachedAccount = updated;
                invalidateAccountSnapshot();
                void showProfile();
              })
              .catch((error: unknown) => {
                window.alert(error instanceof Error ? error.message : 'Unable to update profile picture.');
                choose.disabled = false;
                choose.textContent = account.picture ? 'Change photo' : 'Add photo';
              });
          });
          media.append(picker, choose);
        }

        if (account.picture && handlers.onDeleteProfilePicture) {
          const remove = secondaryButton('Remove photo');
          remove.classList.add('compact-button', 'danger-link-button');
          remove.addEventListener('click', () => {
            if (!window.confirm('Remove your profile picture?')) return;
            remove.disabled = true;
            void handlers.onDeleteProfilePicture!()
              .then((updated) => {
                cachedAccount = updated;
                invalidateAccountSnapshot();
                void showProfile();
              })
              .catch((error: unknown) => {
                window.alert(error instanceof Error ? error.message : 'Unable to remove profile picture.');
                remove.disabled = false;
              });
          });
          media.append(remove);
        }

        if (media.childElementCount > 0) card.append(media);

        const identity = element('div', 'native-profile-identity');
        identity.append(elementWithText('h2', account.fullname || displayName));
        if (account.username) identity.append(elementWithText('span', `@${account.username}`));
        if (account.biography) identity.append(elementWithText('p', account.biography));
        card.append(identity);

        const meta = element('div', 'native-profile-meta');
        if (account.work_title || account.work_place) {
          meta.append(elementWithText('span', [account.work_title, account.work_place].filter(Boolean).join(' at ')));
        }
        if (account.city) meta.append(elementWithText('span', account.city));
        if (account.edu_school) meta.append(elementWithText('span', account.edu_school));
        if (account.website) meta.append(elementWithText('span', account.website));
        if (meta.childElementCount > 0) card.append(meta);

        const edit = secondaryButton('Edit profile');
        edit.addEventListener('click', () => void showProfileEditor(account));
        const settings = secondaryButton('Account & settings');
        settings.addEventListener('click', () => void showSettings());
        content.append(edit, settings);
      } catch (error) {
        card.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load profile.'));
      }
    }

    async function showSettings(): Promise<void> {
      backAction = showAccountMenu;
      setActiveTab('menu');
      content.replaceChildren();
      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', showAccountMenu);
      header.append(back, screenTitle('Account & settings'));
      content.append(header);

      const account = element('section', 'settings-card');
      account.append(elementWithText('h3', 'Account & profile'));
      const accountStatus = paragraph('Loading account details…');
      account.append(accountStatus);
      content.append(account);

      if (handlers.onLoadAccount) {
        try {
          const details = await loadAccountSnapshot();
          accountStatus.textContent = details.email || details.username || displayName;
          const menu = element('div', 'settings-action-grid');

          const actions: Array<[string, () => void]> = [
            ['Edit profile', () => void showProfileEditor(details)],
            ['Login & contact', () => void showIdentityEditor(details)],
            ['Work', () => void showWorkEditor(details)],
            ['Location', () => void showLocationEditor(details)],
            ['Education', () => void showEducationEditor(details)],
            ['Social links', () => void showSocialEditor(details)],
            ['Privacy', () => void showPrivacyEditor(details)],
            ['Change password', () => void showPasswordEditor()]
          ];

          for (const [label, action] of actions) {
            const button = secondaryButton(label);
            button.classList.add('settings-action-button');
            button.addEventListener('click', action);
            menu.append(button);
          }
          account.append(menu);
        } catch (error) {
          accountStatus.textContent = error instanceof Error ? error.message : 'Unable to load account settings.';
        }
      } else {
        accountStatus.textContent = 'Native account editing is not available yet.';
      }

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
                const identity = element('div', 'settings-row-identity');
                identity.append(elementWithText('strong', name));
                if (blockedUser.user_name) identity.append(elementWithText('span', `@${String(blockedUser.user_name)}`));
                row.append(identity);

                if (handlers.onConnect) {
                  const unblock = secondaryButton('Unblock');
                  unblock.classList.add('compact-button');
                  unblock.addEventListener('click', () => {
                    unblock.disabled = true;
                    void handlers.onConnect!('unblock', blockedUser.user_id)
                      .then(() => row.remove())
                      .catch((error: unknown) => {
                        window.alert(error instanceof Error ? error.message : 'Unable to unblock this user.');
                        unblock.disabled = false;
                      });
                  });
                  row.append(unblock);
                }
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

    async function showProfileEditor(account?: MobileAccount): Promise<void> {
      const details = account || (handlers.onLoadAccount ? await loadAccountSnapshot() : undefined);
      if (!details || !handlers.onUpdateProfile) return;

      backAction = () => { void showSettings(); };
      content.replaceChildren();
      const header = settingsEditorHeader('Edit profile');
      content.append(header);

      const form = element('form', 'native-settings-form') as HTMLFormElement;
      const first = settingsInput('First name', 'text', details.firstname || '');
      const last = settingsInput('Last name', 'text', details.lastname || '');
      const bio = settingsTextarea('Bio', details.biography || '', 4);
      const website = settingsInput('Website', 'url', details.website || '');

      const relationship = settingsSelect('Relationship', [
        ['', 'Not specified'],
        ['single', 'Single'],
        ['relationship', 'In a relationship'],
        ['married', 'Married'],
        ['complicated', 'Complicated'],
        ['separated', 'Separated'],
        ['divorced', 'Divorced'],
        ['widowed', 'Widowed']
      ], details.relationship || '');

      const message = element('p', 'settings-form-status');
      const submit = actionButton('Save profile');
      submit.type = 'submit';
      form.append(first.wrapper, last.wrapper, bio.wrapper, website.wrapper, relationship.wrapper, message, submit);

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit.disabled = true;
        message.textContent = 'Saving…';
        const payload: ProfileUpdate = {
          firstname: first.control.value.trim(),
          lastname: last.control.value.trim(),
          biography: bio.control.value.trim(),
          website: website.control.value.trim(),
          relationship: relationship.control.value || null
        };
        void handlers.onUpdateProfile!(payload)
          .then(() => {
            invalidateAccountSnapshot();
            message.textContent = 'Profile updated.';
            window.setTimeout(() => { void showSettings(); }, 250);
          })
          .catch((error: unknown) => {
            message.textContent = error instanceof Error ? error.message : 'Unable to update profile.';
          })
          .finally(() => { submit.disabled = false; });
      });

      content.append(form);
    }

    async function showIdentityEditor(account?: MobileAccount): Promise<void> {
      const details = account || (handlers.onLoadAccount ? await loadAccountSnapshot() : undefined);
      if (!details || !handlers.onUpdateIdentity) return;

      backAction = () => { void showSettings(); };
      content.replaceChildren(settingsEditorHeader('Login & contact'));

      const form = element('form', 'native-settings-form') as HTMLFormElement;
      const username = settingsInput('Username', 'text', details.username || '');
      username.control.disabled = Boolean(details.username_changes_disabled);
      const email = settingsInput('Email', 'email', details.email || '');
      const phone = settingsInput('Phone', 'tel', details.phone || '');
      const password = settingsInput('Current password', 'password', '');
      password.control.autocomplete = 'current-password';
      const message = element('p', 'settings-form-status');
      const submit = actionButton('Save account');
      submit.type = 'submit';

      form.append(username.wrapper, email.wrapper, phone.wrapper, password.wrapper, message, submit);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit.disabled = true;
        message.textContent = 'Saving…';
        void handlers.onUpdateIdentity!({
          username: username.control.value.trim(),
          email: email.control.value.trim(),
          phone: phone.control.value.trim(),
          password: password.control.value
        }).then(() => {
          invalidateAccountSnapshot();
          message.textContent = 'Account updated. Verification may be required for changed email or phone details.';
          password.control.value = '';
        }).catch((error: unknown) => {
          message.textContent = error instanceof Error ? error.message : 'Unable to update account.';
        }).finally(() => { submit.disabled = false; });
      });
      content.append(form);
    }

    async function showWorkEditor(account?: MobileAccount): Promise<void> {
      const details = account || (handlers.onLoadAccount ? await loadAccountSnapshot() : undefined);
      if (!details || !handlers.onUpdateWork) return;
      await showSimpleSettingsEditor('Work', [
        ['Job title', 'text', details.work_title || ''],
        ['Workplace', 'text', details.work_place || ''],
        ['Work website', 'url', details.work_url || '']
      ], async (values) => {
        await handlers.onUpdateWork!({ work_title: values[0], work_place: values[1], work_url: values[2] });
      });
    }

    async function showLocationEditor(account?: MobileAccount): Promise<void> {
      const details = account || (handlers.onLoadAccount ? await loadAccountSnapshot() : undefined);
      if (!details || !handlers.onUpdateLocation) return;
      await showSimpleSettingsEditor('Location', [
        ['Current city', 'text', details.city || ''],
        ['Hometown', 'text', details.hometown || '']
      ], async (values) => {
        await handlers.onUpdateLocation!({ city: values[0], hometown: values[1] });
      });
    }

    async function showEducationEditor(account?: MobileAccount): Promise<void> {
      const details = account || (handlers.onLoadAccount ? await loadAccountSnapshot() : undefined);
      if (!details || !handlers.onUpdateEducation) return;
      await showSimpleSettingsEditor('Education', [
        ['Major', 'text', details.edu_major || ''],
        ['School', 'text', details.edu_school || ''],
        ['Class', 'text', details.edu_class || '']
      ], async (values) => {
        await handlers.onUpdateEducation!({ edu_major: values[0], edu_school: values[1], edu_class: values[2] });
      });
    }

    async function showSocialEditor(account?: MobileAccount): Promise<void> {
      const details = account || (handlers.onLoadAccount ? await loadAccountSnapshot() : undefined);
      if (!details || !handlers.onUpdateSocial) return;
      await showSimpleSettingsEditor('Social links', [
        ['Facebook', 'url', details.facebook || ''],
        ['Twitter / X', 'url', details.twitter || ''],
        ['YouTube', 'url', details.youtube || ''],
        ['Instagram', 'url', details.instagram || ''],
        ['Twitch', 'url', details.twitch || ''],
        ['LinkedIn', 'url', details.linkedin || ''],
        ['VKontakte', 'url', details.vkontakte || '']
      ], async (values) => {
        await handlers.onUpdateSocial!({
          facebook: values[0],
          twitter: values[1],
          youtube: values[2],
          instagram: values[3],
          twitch: values[4],
          linkedin: values[5],
          vkontakte: values[6]
        });
      });
    }

    async function showPrivacyEditor(account?: MobileAccount): Promise<void> {
      const details = account || (handlers.onLoadAccount ? await loadAccountSnapshot() : undefined);
      if (!details || !handlers.onUpdatePrivacy) return;

      backAction = () => { void showSettings(); };
      content.replaceChildren(settingsEditorHeader('Privacy'));

      const privacy = details.privacy || {};
      const form = element('form', 'native-settings-form') as HTMLFormElement;

      const chat = settingsSelect('Who can message me?', [
        ['public', 'Everyone'],
        ['friends', 'Friends'],
        ['me', 'Nobody']
      ], privacy.user_privacy_chat || 'public');

      const wall = settingsSelect('Who can post on my profile?', [
        ['public', 'Everyone'],
        ['friends', 'Friends'],
        ['me', 'Only me']
      ], privacy.user_privacy_wall || 'public');

      const friends = settingsSelect('Who can see my friends?', [
        ['public', 'Everyone'],
        ['friends', 'Friends'],
        ['me', 'Only me']
      ], privacy.user_privacy_friends || 'public');

      const groups = settingsSelect('Who can see my groups?', [
        ['public', 'Everyone'],
        ['friends', 'Friends'],
        ['me', 'Only me']
      ], privacy.user_privacy_groups || 'public');

      const pages = settingsSelect('Who can see my pages?', [
        ['public', 'Everyone'],
        ['friends', 'Friends'],
        ['me', 'Only me']
      ], privacy.user_privacy_pages || 'public');

      const events = settingsSelect('Who can see my events?', [
        ['public', 'Everyone'],
        ['friends', 'Friends'],
        ['me', 'Only me']
      ], privacy.user_privacy_events || 'public');

      const chatEnabled = settingsCheckbox('Enable chat', privacy.user_chat_enabled !== false);
      const newsletter = settingsCheckbox('Email newsletter', Boolean(privacy.user_newsletter_enabled));
      const suggestionsHidden = settingsCheckbox('Hide me from people suggestions', Boolean(privacy.user_suggestions_hidden));
      const incognito = settingsCheckbox('Incognito mode', Boolean(privacy.user_incognito_enabled));

      const message = element('p', 'settings-form-status');
      const submit = actionButton('Save privacy');
      submit.type = 'submit';

      form.append(
        chat.wrapper, wall.wrapper, friends.wrapper, groups.wrapper, pages.wrapper, events.wrapper,
        chatEnabled.wrapper, newsletter.wrapper, suggestionsHidden.wrapper, incognito.wrapper,
        message, submit
      );

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit.disabled = true;
        message.textContent = 'Saving…';
        void handlers.onUpdatePrivacy!({
          user_privacy_chat: chat.control.value,
          user_privacy_wall: wall.control.value,
          user_privacy_friends: friends.control.value,
          user_privacy_groups: groups.control.value,
          user_privacy_pages: pages.control.value,
          user_privacy_events: events.control.value,
          user_chat_enabled: chatEnabled.control.checked,
          user_newsletter_enabled: newsletter.control.checked,
          user_suggestions_hidden: suggestionsHidden.control.checked,
          user_incognito_enabled: incognito.control.checked
        }).then(() => {
          invalidateAccountSnapshot();
          message.textContent = 'Privacy settings updated.';
        }).catch((error: unknown) => {
          message.textContent = error instanceof Error ? error.message : 'Unable to update privacy settings.';
        }).finally(() => { submit.disabled = false; });
      });

      content.append(form);
    }

    async function showPasswordEditor(): Promise<void> {
      if (!handlers.onUpdatePassword) return;
      backAction = () => { void showSettings(); };
      content.replaceChildren(settingsEditorHeader('Change password'));

      const form = element('form', 'native-settings-form') as HTMLFormElement;
      const current = settingsInput('Current password', 'password', '');
      const next = settingsInput('New password', 'password', '');
      const confirm = settingsInput('Confirm new password', 'password', '');
      current.control.autocomplete = 'current-password';
      next.control.autocomplete = 'new-password';
      confirm.control.autocomplete = 'new-password';
      const message = element('p', 'settings-form-status');
      const submit = actionButton('Change password');
      submit.type = 'submit';
      form.append(current.wrapper, next.wrapper, confirm.wrapper, message, submit);

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit.disabled = true;
        message.textContent = 'Updating…';
        void handlers.onUpdatePassword!({
          current: current.control.value,
          new: next.control.value,
          confirm: confirm.control.value
        }).then(() => {
          message.textContent = 'Password updated. Other sessions have been signed out.';
          form.reset();
        }).catch((error: unknown) => {
          message.textContent = error instanceof Error ? error.message : 'Unable to update password.';
        }).finally(() => { submit.disabled = false; });
      });

      content.append(form);
    }

    async function showSimpleSettingsEditor(
      title: string,
      definitions: Array<[string, string, string]>,
      save: (values: string[]) => Promise<void>
    ): Promise<void> {
      backAction = () => { void showSettings(); };
      content.replaceChildren(settingsEditorHeader(title));

      const form = element('form', 'native-settings-form') as HTMLFormElement;
      const fields = definitions.map(([label, type, value]) => settingsInput(label, type, value));
      const message = element('p', 'settings-form-status');
      const submit = actionButton('Save');
      submit.type = 'submit';
      for (const item of fields) form.append(item.wrapper);
      form.append(message, submit);

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit.disabled = true;
        message.textContent = 'Saving…';
        void save(fields.map((item) => item.control.value.trim()))
          .then(() => { invalidateAccountSnapshot(); message.textContent = 'Saved.'; })
          .catch((error: unknown) => {
            message.textContent = error instanceof Error ? error.message : 'Unable to save changes.';
          })
          .finally(() => { submit.disabled = false; });
      });
      content.append(form);
    }

    function settingsEditorHeader(title: string): HTMLElement {
      const header = element('div', 'conversation-header');
      const back = secondaryButton('Back');
      back.classList.add('compact-button');
      back.addEventListener('click', () => { void showSettings(); });
      header.append(back, screenTitle(title));
      return header;
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
              const url = new URL(String(item.url), handlers.trustedWebOrigin || 'https://chatpalez.com');
              dispatchRoute(`${url.pathname}${url.search}${url.hash}`);
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
  const openRoute = (path: string): boolean => {
    if (!routeAction) return false;
    routeAction(path);
    return true;
  };
  return { showStartup, showLogin, showAuthenticated, setBusy, setRetryAction, handleBack, openRoute };
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

function feedCard(post: FeedPost, onOpenPost?: (postId: number | string) => void): HTMLElement {
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

  if (onOpenPost) {
    const actions = element('div', 'native-post-actions');
    const open = secondaryButton('Open post');
    open.classList.add('native-post-action');
    open.addEventListener('click', () => onOpenPost(post.post_id));
    actions.append(open);
    card.append(actions);
  }
  return card;
}

function commentCard(
  comment: PostComment,
  handlers: AppShellHandlers,
  refresh?: () => Promise<void>
): HTMLElement {
  const item = element('article', 'native-comment');
  if (comment.author_picture) {
    const avatar = document.createElement('img');
    avatar.className = 'native-comment-avatar';
    avatar.src = comment.author_picture;
    avatar.alt = '';
    item.append(avatar);
  }

  const body = element('div', 'native-comment-body');
  body.append(elementWithText('strong', comment.author_name || 'ChatPalez'));
  const text = elementWithText('p', comment.text || '');
  body.append(text);

  const meta = element('div', 'native-comment-meta');
  if (comment.time) meta.append(elementWithText('span', comment.time));
  if (comment.reactions_total_count) meta.append(elementWithText('span', `${comment.reactions_total_count} reactions`));
  if (comment.replies) meta.append(elementWithText('span', `${comment.replies} replies`));
  body.append(meta);

  const actions = element('div', 'native-comment-actions');

  if (handlers.onReactToComment) {
    const like = secondaryButton(comment.i_react ? 'Unlike' : 'Like');
    like.classList.add('native-comment-action');
    like.addEventListener('click', () => {
      const remove = Boolean(comment.i_react);
      const reaction = comment.i_reaction || 'like';
      like.disabled = true;
      void handlers.onReactToComment!(comment.comment_id, reaction, remove)
        .then(() => {
          comment.i_react = !remove;
          comment.i_reaction = comment.i_react ? reaction : null;
          comment.reactions_total_count = Math.max(0, Number(comment.reactions_total_count || 0) + (comment.i_react ? 1 : -1));
          like.textContent = comment.i_react ? 'Unlike' : 'Like';
        })
        .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to react to comment.'))
        .finally(() => { like.disabled = false; });
    });
    actions.append(like);
  }

  if (comment.edit_comment && handlers.onEditComment) {
    const edit = secondaryButton('Edit');
    edit.classList.add('native-comment-action');
    edit.addEventListener('click', () => {
      const next = window.prompt('Edit comment', comment.text || '');
      if (next === null || !next.trim()) return;
      edit.disabled = true;
      void handlers.onEditComment!(comment.comment_id, next.trim())
        .then(() => {
          comment.text = next.trim();
          text.textContent = comment.text;
        })
        .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to edit comment.'))
        .finally(() => { edit.disabled = false; });
    });
    actions.append(edit);
  }

  if (comment.delete_comment && handlers.onDeleteComment) {
    const remove = secondaryButton('Delete');
    remove.classList.add('native-comment-action', 'danger-link-button');
    remove.addEventListener('click', () => {
      if (!window.confirm('Delete this comment?')) return;
      remove.disabled = true;
      void handlers.onDeleteComment!(comment.comment_id)
        .then(async () => {
          if (refresh) await refresh();
          else item.remove();
        })
        .catch((error: unknown) => {
          window.alert(error instanceof Error ? error.message : 'Unable to delete comment.');
          remove.disabled = false;
        });
    });
    actions.append(remove);
  }

  if (actions.childElementCount > 0) body.append(actions);
  item.append(body);
  return item;
}

function localTabs(items: Array<[string, () => void, boolean]>): HTMLElement {
  const tabs = element('div', 'local-tabs');
  for (const [label, action, active] of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'local-tab';
    button.classList.toggle('is-active', active);
    button.textContent = label;
    button.addEventListener('click', action);
    tabs.append(button);
  }
  return tabs;
}

function communityCard(imageUrl: string | undefined, title: string, meta: string): HTMLElement {
  const card = element('article', 'community-card');
  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'community-card-image';
    image.src = imageUrl;
    image.alt = title;
    image.loading = 'lazy';
    card.append(image);
  }
  const body = element('div', 'community-card-body');
  body.append(elementWithText('strong', title), elementWithText('span', meta));
  card.append(body);
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
function settingsInput(label: string, type: string, value: string): { wrapper: HTMLLabelElement; control: HTMLInputElement } {
  const wrapper = element('label', 'field') as HTMLLabelElement;
  const control = document.createElement('input');
  control.type = type;
  control.value = value;
  control.placeholder = label;
  wrapper.append(elementWithText('span', label), control);
  return { wrapper, control };
}

function settingsTextarea(label: string, value: string, rows = 3): { wrapper: HTMLLabelElement; control: HTMLTextAreaElement } {
  const wrapper = element('label', 'field') as HTMLLabelElement;
  const control = document.createElement('textarea');
  control.rows = rows;
  control.value = value;
  control.placeholder = label;
  wrapper.append(elementWithText('span', label), control);
  return { wrapper, control };
}

function settingsCheckbox(label: string, checked: boolean): { wrapper: HTMLLabelElement; control: HTMLInputElement } {
  const wrapper = element('label', 'settings-checkbox') as HTMLLabelElement;
  const control = document.createElement('input');
  control.type = 'checkbox';
  control.checked = checked;
  wrapper.append(control, elementWithText('span', label));
  return { wrapper, control };
}

function settingsSelect(
  label: string,
  options: Array<[string, string]>,
  value: string
): { wrapper: HTMLLabelElement; control: HTMLSelectElement } {
  const wrapper = element('label', 'field') as HTMLLabelElement;
  const control = document.createElement('select');
  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = optionValue === value;
    control.append(option);
  }
  wrapper.append(elementWithText('span', label), control);
  return { wrapper, control };
}

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

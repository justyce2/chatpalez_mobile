import type { Conversation } from './api/chat';
import type { AuthSession } from './auth/session';

export type LoginCredentials = {
  usernameEmail: string;
  password: string;
};

export type AppShellHandlers = {
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  onLogout: () => Promise<void>;
  onOpenWebModule: (path: string) => void;
  onLoadConversations: () => Promise<Conversation[]>;
};

export type AppShell = {
  showStartup: (title: string, message: string, canRetry?: boolean) => void;
  showLogin: (error?: string) => void;
  showAuthenticated: (session: AuthSession) => void;
  setBusy: (busy: boolean, message?: string) => void;
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

      void handlers.onLogin({
        usernameEmail: identity.value,
        password: password.value
      }).catch((reason: unknown) => {
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
      { id: 'messages', label: 'Messages' },
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
        content.append(screenTitle(`Hi, ${displayName}`));
        content.append(paragraph('Your local ChatPalez app shell is active. The social feed remains on the controlled migration path while API coverage is finalized.'));
        const webFeed = secondaryButton('Open current feed');
        webFeed.addEventListener('click', () => handlers.onOpenWebModule('/'));
        content.append(webFeed);
        return;
      }

      if (tab === 'messages') {
        content.append(screenTitle('Messages'));
        const loading = paragraph('Loading conversations…');
        content.append(loading);

        try {
          const conversations = await handlers.onLoadConversations();
          content.replaceChildren(screenTitle('Messages'));
          if (conversations.length === 0) {
            content.append(paragraph('No conversations yet.'));
            return;
          }

          const list = element('div', 'conversation-list');
          for (const conversation of conversations) {
            const item = element('button', 'conversation-item');
            item.type = 'button';
            const name = String(conversation.name || conversation.name_list || 'Conversation');
            const title = elementWithText('strong', name);
            const meta = elementWithText('span', conversation.user_is_online ? 'Online' : 'Open conversation');
            item.append(title, meta);
            item.addEventListener('click', () => handlers.onOpenWebModule(`/messages/${conversation.conversation_id}`));
            list.append(item);
          }
          content.append(list);
        } catch (error) {
          content.replaceChildren(screenTitle('Messages'));
          content.append(paragraph(error instanceof Error ? error.message : 'Unable to load conversations.'));
          const retry = secondaryButton('Try again');
          retry.addEventListener('click', () => void selectTab('messages'));
          content.append(retry);
        }
        return;
      }

      if (tab === 'notifications') {
        content.append(screenTitle('Notifications'));
        content.append(paragraph('Native push routing is available. The notification-list API mapping remains the next API capability gap.'));
        return;
      }

      content.append(screenTitle('Profile'));
      const profileCard = element('div', 'profile-card');
      profileCard.append(elementWithText('strong', displayName));
      if (user.user_email) profileCard.append(elementWithText('span', String(user.user_email)));
      if (user.user_name) profileCard.append(elementWithText('span', `@${String(user.user_name)}`));
      content.append(profileCard);

      const settings = secondaryButton('Account & settings');
      settings.addEventListener('click', () => handlers.onOpenWebModule('/settings'));
      const logout = secondaryButton('Sign out');
      logout.addEventListener('click', () => void handlers.onLogout());
      content.append(settings, logout);
    }

    layout.append(topbar, content, nav);
    root.append(layout);
    void selectTab('home');
  };

  const setBusy = (busy: boolean, message = 'Please wait…'): void => {
    root.toggleAttribute('aria-busy', busy);
    if (busy) root.dataset.busyMessage = message;
    else delete root.dataset.busyMessage;
  };

  retryAction = () => showLogin();

  return { showStartup, showLogin, showAuthenticated, setBusy };
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

function heading(text: string): HTMLHeadingElement {
  return elementWithText('h1', text);
}

function screenTitle(text: string): HTMLHeadingElement {
  const title = elementWithText('h2', text);
  title.className = 'screen-title';
  return title;
}

function paragraph(text: string): HTMLParagraphElement {
  return elementWithText('p', text);
}

function brandMark(size?: 'small'): HTMLDivElement {
  const mark = elementWithText('div', 'C');
  mark.className = size === 'small' ? 'brand-mark brand-mark-small' : 'brand-mark';
  mark.setAttribute('aria-hidden', 'true');
  return mark;
}

function actionButton(text: string): HTMLButtonElement {
  const button = elementWithText('button', text);
  button.type = 'button';
  button.className = 'primary-button';
  return button;
}

function secondaryButton(text: string): HTMLButtonElement {
  const button = elementWithText('button', text);
  button.type = 'button';
  button.className = 'secondary-button';
  return button;
}

function input(type: string, placeholder: string, name: string): HTMLInputElement {
  const node = document.createElement('input');
  node.type = type;
  node.placeholder = placeholder;
  node.name = name;
  node.required = true;
  return node;
}

function field(label: string, control: HTMLInputElement): HTMLLabelElement {
  const node = element('label', 'field');
  node.append(elementWithText('span', label), control);
  return node;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'C';
}

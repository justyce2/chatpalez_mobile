import type { UserProfile, BlockedUser } from '../api/user';
import type { AuthSession } from '../auth/session';
import type { NativeNotificationStatus } from '../notifications/native';

export type ProfilePageResult<T> = { items: T[]; hasMore: boolean };

export type ProfileScreenHandlers = {
  onLoadProfile?: () => Promise<UserProfile>;
  onManageNotifications?: () => Promise<NativeNotificationStatus>;
  onLoadBlockedUsers?: (offset: number) => Promise<ProfilePageResult<BlockedUser>>;
  onDeleteAccount?: (password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onOpenPublicPage?: (path: string) => void;
  onOpenWebModule: (path: string) => void;
};

export class ProfileScreen {
  constructor(
    private readonly content: HTMLElement,
    private readonly session: AuthSession,
    private readonly handlers: ProfileScreenHandlers
  ) {}

  async render(): Promise<void> {
    const user = this.session.user;
    const fallbackName = String(user.user_fullname || user.user_firstname || user.user_name || 'ChatPalez');
    this.content.replaceChildren(title('Profile'), paragraph('Loading profile…'));

    let profile: UserProfile = {
      user_id: user.user_id,
      user_name: user.user_name,
      user_firstname: user.user_firstname,
      user_lastname: user.user_lastname,
      user_fullname: user.user_fullname,
      user_picture: user.user_picture
    };

    if (this.handlers.onLoadProfile) {
      try {
        profile = await this.handlers.onLoadProfile();
      } catch (error) {
        this.content.replaceChildren(title('Profile'));
        this.content.append(paragraph(error instanceof Error ? error.message : 'Unable to refresh profile details.'));
      }
    }

    const name = String(profile.user_fullname || profile.user_firstname || profile.user_name || fallbackName);
    this.content.replaceChildren(title('Profile'));

    const hero = element('section', 'native-profile-card profile-screen-hero');
    if (profile.user_cover) {
      const cover = document.createElement('img');
      cover.className = 'native-profile-cover';
      cover.src = String(profile.user_cover);
      cover.alt = '';
      cover.loading = 'lazy';
      hero.append(cover);
    }

    const identity = element('div', 'native-profile-identity');
    if (profile.user_picture) {
      const photo = document.createElement('img');
      photo.className = 'native-profile-avatar';
      photo.src = String(profile.user_picture);
      photo.alt = name;
      photo.loading = 'lazy';
      identity.append(photo);
    } else {
      const fallback = elementWithText('div', initials(name));
      fallback.className = 'native-profile-avatar native-profile-avatar--fallback';
      identity.append(fallback);
    }

    const copy = element('div', 'native-profile-copy');
    const nameRow = element('div', 'native-profile-name-row');
    nameRow.append(elementWithText('strong', name));
    if (profile.user_verified) nameRow.append(elementWithText('span', '✓'));
    copy.append(nameRow);
    if (profile.user_name) copy.append(elementWithText('span', `@${String(profile.user_name)}`));
    if (profile.user_biography) copy.append(elementWithText('p', String(profile.user_biography)));
    identity.append(copy);
    hero.append(identity);

    const stats = element('div', 'native-profile-stats');
    for (const [label, value] of [
      ['Friends', profile.friends_count],
      ['Followers', profile.followers_count],
      ['Following', profile.followings_count]
    ] as Array<[string, unknown]>) {
      if (value === null || value === undefined || value === '') continue;
      const stat = element('div', 'native-profile-stat');
      stat.append(elementWithText('strong', String(value)), elementWithText('span', label));
      stats.append(stat);
    }
    if (stats.childElementCount) hero.append(stats);
    this.content.append(hero);

    const about = element('section', 'settings-card native-profile-details');
    about.append(elementWithText('h3', 'About'));
    let count = 0;
    for (const [label, value] of [
      ['Work', [profile.user_work_title, profile.user_work_place].filter(Boolean).join(' · ')],
      ['Current city', profile.user_current_city],
      ['Hometown', profile.user_hometown],
      ['Relationship', profile.user_relationship],
      ['Birthday', profile.user_birthdate]
    ] as Array<[string, unknown]>) {
      if (!value) continue;
      const row = element('div', 'native-profile-detail-row');
      row.append(elementWithText('span', label), elementWithText('strong', String(value)));
      about.append(row);
      count += 1;
    }
    if (!count) about.append(paragraph('No additional profile details yet.'));
    this.content.append(about);

    const account = element('section', 'settings-card profile-actions');
    account.append(elementWithText('h3', 'Account & profile'));
    const settings = secondaryButton('Account & settings');
    settings.addEventListener('click', () => void this.renderSettings());
    const advanced = secondaryButton('Advanced profile settings');
    advanced.addEventListener('click', () => this.handlers.onOpenWebModule('/settings/profile'));
    account.append(settings, advanced);
    this.content.append(account);

    const support = element('section', 'settings-card profile-actions');
    support.append(elementWithText('h3', 'Support & legal'));
    const contact = secondaryButton('Contact us');
    contact.addEventListener('click', () => this.handlers.onOpenPublicPage?.('/contacts'));
    const privacy = secondaryButton('Privacy policy');
    privacy.addEventListener('click', () => this.handlers.onOpenPublicPage?.('/static/privacy'));
    const deletionInfo = secondaryButton('Account deletion information');
    deletionInfo.addEventListener('click', () => this.handlers.onOpenPublicPage?.('/account-deletion.php'));
    support.append(contact, privacy, deletionInfo);
    this.content.append(support);

    const logout = secondaryButton('Sign out');
    logout.addEventListener('click', () => void this.handlers.onLogout());
    this.content.append(logout);
  }

  private async renderSettings(): Promise<void> {
    const user = this.session.user;
    const name = String(user.user_fullname || user.user_firstname || user.user_name || 'ChatPalez');
    this.content.replaceChildren();

    const header = element('div', 'conversation-header');
    const back = secondaryButton('Back');
    back.classList.add('compact-button');
    back.addEventListener('click', () => void this.render());
    header.append(back, title('Account & settings'));
    this.content.append(header);

    const account = element('section', 'settings-card');
    account.append(elementWithText('h3', 'Account'));
    account.append(elementWithText('strong', name));
    if (user.user_email) account.append(elementWithText('span', String(user.user_email)));
    this.content.append(account);

    const push = element('section', 'settings-card');
    push.append(elementWithText('h3', 'Push notifications'));
    const pushStatus = paragraph('Enable notifications for messages and account activity on this device.');
    push.append(pushStatus);
    if (this.handlers.onManageNotifications) {
      const enablePush = secondaryButton('Manage notifications');
      enablePush.addEventListener('click', () => {
        enablePush.disabled = true;
        enablePush.textContent = 'Checking…';
        void this.handlers.onManageNotifications!()
          .then((status) => {
            pushStatus.textContent = notificationStatus(status);
            enablePush.textContent = status === 'enabled' ? 'Notifications enabled' : 'Manage notifications';
          })
          .catch((error: unknown) => {
            pushStatus.textContent = error instanceof Error ? error.message : 'Unable to update notification permission.';
            enablePush.textContent = 'Try again';
          })
          .finally(() => { enablePush.disabled = false; });
      });
      push.append(enablePush);
    }
    this.content.append(push);

    const blocked = element('section', 'settings-card');
    blocked.append(elementWithText('h3', 'Blocked users'));
    const blockedBody = element('div', 'settings-list');
    blockedBody.append(paragraph('Loading blocked users…'));
    blocked.append(blockedBody);
    const more = secondaryButton('Load more blocked users');
    more.hidden = true;
    blocked.append(more);
    this.content.append(blocked);

    if (this.handlers.onLoadBlockedUsers) {
      let offset = 0;
      const load = async (append = false): Promise<void> => {
        try {
          const page = await this.handlers.onLoadBlockedUsers!(offset);
          if (!append) blockedBody.replaceChildren();
          if (!append && page.items.length === 0) blockedBody.append(paragraph('You have not blocked anyone.'));
          for (const blockedUser of page.items) {
            const row = element('div', 'settings-row');
            const blockedName = String(blockedUser.user_firstname || blockedUser.user_name || `User ${blockedUser.user_id}`);
            row.append(elementWithText('strong', blockedName));
            if (blockedUser.user_name) row.append(elementWithText('span', `@${String(blockedUser.user_name)}`));
            blockedBody.append(row);
          }
          more.hidden = !page.hasMore;
        } catch (error) {
          blockedBody.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load blocked users.'));
        }
      };
      more.addEventListener('click', () => { offset += 1; void load(true); });
      await load();
    } else {
      blockedBody.replaceChildren(paragraph('Blocked-user management is unavailable in this build.'));
    }

    const compliance = element('section', 'settings-card');
    compliance.append(elementWithText('h3', 'Privacy & account controls'));
    compliance.append(paragraph('These controls remain available inside the app so account management does not depend on an external browser.'));
    const privacy = secondaryButton('Privacy settings');
    privacy.addEventListener('click', () => this.handlers.onOpenWebModule('/settings/privacy'));
    const profile = secondaryButton('Edit profile');
    profile.addEventListener('click', () => this.handlers.onOpenWebModule('/settings/profile'));
    const password = secondaryButton('Change password');
    password.addEventListener('click', () => this.handlers.onOpenWebModule('/settings/password'));
    compliance.append(profile, privacy, password);
    this.content.append(compliance);

    const danger = element('section', 'settings-card danger-card');
    danger.append(elementWithText('h3', 'Delete account'));
    danger.append(paragraph('Deleting your account is permanent. Enter your current password to confirm.'));
    const form = document.createElement('form');
    form.className = 'delete-account-form';
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Current password';
    passwordInput.autocomplete = 'current-password';
    passwordInput.required = true;
    const submit = primaryButton('Delete my account');
    submit.classList.add('danger-button');
    submit.type = 'submit';
    const error = element('p', 'form-error');
    error.hidden = true;
    form.append(passwordInput, error, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.handlers.onDeleteAccount || !passwordInput.value) return;
      if (!window.confirm('Permanently delete your ChatPalez account? This cannot be undone.')) return;
      submit.disabled = true;
      submit.textContent = 'Deleting…';
      error.hidden = true;
      void this.handlers.onDeleteAccount(passwordInput.value).catch((reason: unknown) => {
        error.textContent = reason instanceof Error ? reason.message : 'Unable to delete account.';
        error.hidden = false;
        submit.disabled = false;
        submit.textContent = 'Delete my account';
      });
    });
    danger.append(form);
    this.content.append(danger);
  }
}

function notificationStatus(status: NativeNotificationStatus): string {
  if (status === 'enabled') return 'Notifications are enabled for this device.';
  if (status === 'disabled') return 'Notifications are currently disabled. You can enable them in your device settings.';
  if (status === 'not-configured') return 'Notifications are not configured for this app build yet.';
  return 'Native notifications are available in the installed Android or iOS app.';
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
function paragraph(text: string): HTMLParagraphElement { return elementWithText('p', text); }
function title(text: string): HTMLHeadingElement {
  const node = elementWithText('h2', text);
  node.className = 'screen-title';
  return node;
}
function secondaryButton(text: string): HTMLButtonElement {
  const button = elementWithText('button', text);
  button.type = 'button';
  button.className = 'secondary-button';
  return button;
}
function primaryButton(text: string): HTMLButtonElement {
  const button = elementWithText('button', text);
  button.type = 'button';
  button.className = 'primary-button';
  return button;
}
function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'C';
}

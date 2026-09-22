import type { BlockedUser, MobileAccount, ProfileUpdate, UserProfile } from '../api/user';
import type { AuthSession } from '../auth/session';
import type { NativeNotificationStatus } from '../notifications/native';

export type ProfilePageResult<T> = { items: T[]; hasMore: boolean };

export type ProfileScreenHandlers = {
  onLoadProfile?: () => Promise<UserProfile>;
  onLoadAccount?: () => Promise<MobileAccount>;
  onUpdateProfile?: (payload: ProfileUpdate) => Promise<void>;
  onUpdateIdentity?: (payload: { username: string; email: string; phone: string; password: string }) => Promise<void>;
  onUpdateWork?: (payload: { work_title: string; work_place: string; work_url: string }) => Promise<void>;
  onUpdateLocation?: (payload: { city: string; hometown: string }) => Promise<void>;
  onUpdateEducation?: (payload: { edu_major: string; edu_school: string; edu_class: string }) => Promise<void>;
  onUpdateSocial?: (payload: { facebook: string; twitter: string; youtube: string; instagram: string; twitch: string; linkedin: string; vkontakte: string }) => Promise<void>;
  onUpdatePassword?: (payload: { current: string; new: string; confirm: string }) => Promise<void>;
  onUpdatePrivacy?: (payload: Record<string, string | boolean>) => Promise<void>;
  onManageNotifications?: () => Promise<NativeNotificationStatus>;
  onLoadBlockedUsers?: (offset: number) => Promise<ProfilePageResult<BlockedUser>>;
  onDeleteAccount?: (password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onOpenPublicPage?: (path: string) => void;
  onOpenWebModule: (path: string, target?: string) => void;
};

export class ProfileScreen {
  private account: MobileAccount | null = null;

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
      try { profile = await this.handlers.onLoadProfile(); } catch { /* render session fallback */ }
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
      ['Friends', profile.friends_count], ['Followers', profile.followers_count], ['Following', profile.followings_count]
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
      ['Current city', profile.user_current_city], ['Hometown', profile.user_hometown],
      ['Relationship', profile.user_relationship], ['Birthday', profile.user_birthdate]
    ] as Array<[string, unknown]>) {
      if (!value) continue;
      const row = element('div', 'native-profile-detail-row');
      row.append(elementWithText('span', label), elementWithText('strong', String(value)));
      about.append(row); count += 1;
    }
    if (!count) about.append(paragraph('No additional profile details yet.'));
    this.content.append(about);

    const actions = element('section', 'settings-card profile-actions');
    actions.append(elementWithText('h3', 'Account & profile'));
    const settings = secondaryButton('Account & settings');
    settings.addEventListener('click', () => void this.renderSettings());
    actions.append(settings);
    this.content.append(actions);

    const support = element('section', 'settings-card profile-actions');
    support.append(elementWithText('h3', 'Support & legal'));
    for (const [label, path] of [['Contact us','/contacts'],['Privacy policy','/static/privacy'],['Account deletion information','/account-deletion.php']] as Array<[string,string]>) {
      const button = secondaryButton(label);
      button.addEventListener('click', () => this.handlers.onOpenPublicPage?.(path));
      support.append(button);
    }
    this.content.append(support);
    const logout = secondaryButton('Sign out');
    logout.addEventListener('click', () => void this.handlers.onLogout());
    this.content.append(logout);
  }

  private async loadAccount(): Promise<MobileAccount | null> {
    if (this.account) return this.account;
    if (!this.handlers.onLoadAccount) return null;
    this.account = await this.handlers.onLoadAccount();
    return this.account;
  }

  private async renderSettings(): Promise<void> {
    this.content.replaceChildren();
    this.content.append(backHeader('Account & settings', () => void this.render()));
    const status = paragraph('Loading account controls…');
    this.content.append(status);

    let account: MobileAccount | null = null;
    try {
      account = await this.loadAccount();
    } catch {
      status.textContent = 'Account controls are temporarily unavailable. Your notification, privacy-safety and account deletion controls remain available below.';
      status.className = 'settings-inline-notice';
    }
    if (account) {
      status.remove();
      const card = element('section', 'settings-card');
      card.append(elementWithText('h3', 'Profile & account'));
      const actions: Array<[string, () => void]> = [
        ['Edit profile', () => void this.renderProfileEditor(account!)],
        ['Login & contact', () => void this.renderIdentityEditor(account!)],
        ['Work', () => void this.renderSimpleEditor('Work', [
          ['Job title', account!.work_title || ''], ['Workplace', account!.work_place || ''], ['Work website', account!.work_url || '']
        ], async (v) => this.handlers.onUpdateWork?.({ work_title: v[0], work_place: v[1], work_url: v[2] }))],
        ['Location', () => void this.renderSimpleEditor('Location', [
          ['Current city', account!.city || ''], ['Hometown', account!.hometown || '']
        ], async (v) => this.handlers.onUpdateLocation?.({ city: v[0], hometown: v[1] }))],
        ['Education', () => void this.renderSimpleEditor('Education', [
          ['Major', account!.edu_major || ''], ['School', account!.edu_school || ''], ['Class', account!.edu_class || '']
        ], async (v) => this.handlers.onUpdateEducation?.({ edu_major: v[0], edu_school: v[1], edu_class: v[2] }))],
        ['Social links', () => void this.renderSocialEditor(account!)],
        ['Privacy', () => void this.renderPrivacyEditor(account!)],
        ['Change password', () => void this.renderPasswordEditor()]
      ];
      for (const [label, action] of actions) {
        const button = secondaryButton(label); button.addEventListener('click', action); card.append(button);
      }
      this.content.append(card);
    }

    await this.renderNotificationAndSafetyControls();
  }

  private async renderNotificationAndSafetyControls(): Promise<void> {
    const push = element('section', 'settings-card');
    push.append(elementWithText('h3', 'Push notifications'));
    const pushStatus = paragraph('Manage messages and account activity notifications for this device.');
    push.append(pushStatus);
    if (this.handlers.onManageNotifications) {
      const button = secondaryButton('Manage notifications');
      button.addEventListener('click', () => {
        button.disabled = true;
        void this.handlers.onManageNotifications!().then((s) => {
          pushStatus.textContent = notificationStatus(s);
        }).finally(() => { button.disabled = false; });
      });
      push.append(button);
    }
    this.content.append(push);

    const blocked = element('section', 'settings-card');
    blocked.append(elementWithText('h3', 'Blocked users'));
    const body = element('div', 'settings-list');
    body.append(paragraph('Loading blocked users…'));
    blocked.append(body);
    this.content.append(blocked);
    if (this.handlers.onLoadBlockedUsers) {
      try {
        const page = await this.handlers.onLoadBlockedUsers(0);
        body.replaceChildren();
        if (!page.items.length) body.append(paragraph('You have not blocked anyone.'));
        for (const item of page.items) body.append(elementWithText('div', item.user_name ? `@${item.user_name}` : String(item.user_firstname || item.user_id)));
      } catch (error) {
        body.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load blocked users.'));
      }
    }

    const danger = element('section', 'settings-card danger-card');
    danger.append(elementWithText('h3', 'Delete account'), paragraph('Deleting your account is permanent and is available directly inside the app.'));
    const form = document.createElement('form');
    form.className = 'delete-account-form';
    const password = formInput('Current password', '', 'password');
    password.autocomplete = 'current-password';
    const submit = primaryButton('Delete my account'); submit.type = 'submit'; submit.classList.add('danger-button');
    const error = element('p', 'form-error'); error.hidden = true;
    form.append(password, error, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.handlers.onDeleteAccount || !password.value) return;
      if (!window.confirm('Permanently delete your ChatPalez account? This cannot be undone.')) return;
      submit.disabled = true;
      void this.handlers.onDeleteAccount(password.value).catch((reason: unknown) => {
        error.textContent = reason instanceof Error ? reason.message : 'Unable to delete account.';
        error.hidden = false; submit.disabled = false;
      });
    });
    danger.append(form); this.content.append(danger);
  }

  private async renderProfileEditor(account: MobileAccount): Promise<void> {
    this.content.replaceChildren(backHeader('Edit profile', () => void this.renderSettings()));
    const first = formInput('First name', account.firstname || '');
    const last = formInput('Last name', account.lastname || '');
    const bio = formTextarea('Bio', account.biography || '');
    const website = formInput('Website', account.website || '', 'url');
    const relationship = formInput('Relationship', account.relationship || '');
    await this.renderForm([first,last,bio,website,relationship], 'Save profile', async () => {
      await this.handlers.onUpdateProfile?.({
        firstname:first.value.trim(), lastname:last.value.trim(), biography:bio.value.trim(),
        website:website.value.trim(), relationship:relationship.value.trim() || null
      });
    });
  }

  private async renderIdentityEditor(account: MobileAccount): Promise<void> {
    this.content.replaceChildren(backHeader('Login & contact', () => void this.renderSettings()));
    const username = formInput('Username', account.username || '');
    username.disabled = Boolean(account.username_changes_disabled);
    const email = formInput('Email', account.email || '', 'email');
    const phone = formInput('Phone', account.phone || '', 'tel');
    const password = formInput('Current password', '', 'password');
    await this.renderForm([username,email,phone,password], 'Save account', async () => {
      await this.handlers.onUpdateIdentity?.({ username:username.value.trim(), email:email.value.trim(), phone:phone.value.trim(), password:password.value });
    });
  }

  private async renderSocialEditor(account: MobileAccount): Promise<void> {
    this.content.replaceChildren(backHeader('Social links', () => void this.renderSettings()));
    const fields = ['facebook','twitter','youtube','instagram','twitch','linkedin','vkontakte'] as const;
    const inputs = fields.map((key) => formInput(key[0].toUpperCase()+key.slice(1), account[key] || '', 'url'));
    await this.renderForm(inputs, 'Save social links', async () => {
      await this.handlers.onUpdateSocial?.({
        facebook:inputs[0].value, twitter:inputs[1].value, youtube:inputs[2].value, instagram:inputs[3].value,
        twitch:inputs[4].value, linkedin:inputs[5].value, vkontakte:inputs[6].value
      });
    });
  }

  private async renderPrivacyEditor(account: MobileAccount): Promise<void> {
    this.content.replaceChildren(backHeader('Privacy', () => void this.renderSettings()));
    const privacy = account.privacy || {};
    const chat = formInput('Who can chat with me', String(privacy.user_privacy_chat || 'public'));
    const wall = formInput('Who can post on my wall', String(privacy.user_privacy_wall || 'public'));
    const friends = formInput('Who can see my friends', String(privacy.user_privacy_friends || 'public'));
    const photos = formInput('Who can see my photos', String(privacy.user_privacy_photos || 'public'));
    await this.renderForm([chat,wall,friends,photos], 'Save privacy', async () => {
      await this.handlers.onUpdatePrivacy?.({
        ...privacy,
        user_privacy_chat:chat.value, user_privacy_wall:wall.value, user_privacy_friends:friends.value, user_privacy_photos:photos.value
      });
    });
  }

  private async renderPasswordEditor(): Promise<void> {
    this.content.replaceChildren(backHeader('Change password', () => void this.renderSettings()));
    const current = formInput('Current password', '', 'password');
    const next = formInput('New password', '', 'password');
    const confirm = formInput('Confirm new password', '', 'password');
    await this.renderForm([current,next,confirm], 'Change password', async () => {
      await this.handlers.onUpdatePassword?.({ current:current.value, new:next.value, confirm:confirm.value });
    });
  }

  private async renderSimpleEditor(
    heading: string,
    fields: Array<[string,string]>,
    save: (values: string[]) => Promise<void | undefined>
  ): Promise<void> {
    this.content.replaceChildren(backHeader(heading, () => void this.renderSettings()));
    const inputs = fields.map(([label,value]) => formInput(label,value));
    await this.renderForm(inputs, 'Save', async () => save(inputs.map((input) => input.value.trim())));
  }

  private async renderForm(
    controls: Array<HTMLInputElement | HTMLTextAreaElement>,
    submitLabel: string,
    save: () => Promise<void | undefined>
  ): Promise<void> {
    const form = element('form', 'native-settings-form') as HTMLFormElement;
    for (const control of controls) form.append(field(control.placeholder, control));
    const message = element('p', 'settings-form-status');
    const submit = primaryButton(submitLabel); submit.type = 'submit';
    form.append(message, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault(); submit.disabled = true; message.textContent = 'Saving…';
      void save().then(() => {
        this.account = null; message.textContent = 'Saved.';
      }).catch((error: unknown) => {
        message.textContent = error instanceof Error ? error.message : 'Unable to save changes.';
      }).finally(() => { submit.disabled = false; });
    });
    this.content.append(form);
  }
}

function notificationStatus(status: NativeNotificationStatus): string {
  if (status === 'enabled') return 'Notifications are enabled for this device.';
  if (status === 'disabled') return 'Notifications are disabled in device settings.';
  if (status === 'not-configured') return 'Notifications are not configured for this app build yet.';
  return 'Native notifications are available in the installed Android or iOS app.';
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node=document.createElement(tag); if(className) node.className=className; return node;
}
function elementWithText<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
  const node=element(tag); node.textContent=text; return node;
}
function paragraph(text:string):HTMLParagraphElement{return elementWithText('p',text);}
function title(text:string):HTMLHeadingElement{const node=elementWithText('h2',text);node.className='screen-title';return node;}
function secondaryButton(text:string):HTMLButtonElement{const b=elementWithText('button',text);b.type='button';b.className='secondary-button';return b;}
function primaryButton(text:string):HTMLButtonElement{const b=elementWithText('button',text);b.type='button';b.className='primary-button';return b;}
function initials(name:string):string{return name.trim().split(/\s+/).slice(0,2).map((part)=>part[0]?.toUpperCase()??'').join('')||'C';}
function backHeader(text:string,onBack:()=>void):HTMLDivElement{const h=element('div','conversation-header');const b=secondaryButton('Back');b.classList.add('compact-button');b.addEventListener('click',onBack);h.append(b,title(text));return h;}
function formInput(label:string,value:string,type='text'):HTMLInputElement{const i=document.createElement('input');i.placeholder=label;i.value=value;i.type=type;return i;}
function formTextarea(label:string,value:string):HTMLTextAreaElement{const i=document.createElement('textarea');i.placeholder=label;i.value=value;i.rows=4;return i;}
function field(label:string,control:HTMLElement):HTMLLabelElement{const l=element('label','field');l.append(elementWithText('span',label),control);return l;}

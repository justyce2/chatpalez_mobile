import type { ChatContact, ChatFeatures, Conversation, Message, MessagesResult } from '../api/chat';
import type { AuthSession } from '../auth/session';
import { CoalescedResync } from '../chat-resync';
import { RealtimeDeliveryUncertainError } from '../chat-realtime';
import { isChatSoundEnabled, playSentChatSound, setChatSoundEnabled, unlockChatAudio } from '../chat-sound';
import { latestOutgoingReceipt } from '../chat-receipts';
import { mergeChatHistory } from '../chat-history';
import { clearDirectChatHistory } from '../chat-clear';
import { chatProfilePath } from '../chat-profile-route';
import type { MobileAccount } from '../api/user';

export type ChatPageResult<T> = { items: T[]; hasMore: boolean };
export type ChatDeliveryTransport = 'realtime' | 'http';

export type ChatScreenHandlers = {
  onConversationModeChange?: (active: boolean) => void;
  onOpenThreadRoute?: (conversation: Conversation) => void;
  onOpenComposeRoute?: () => void;
  onOpenCommunityGroups?: (path: string) => void;
  onOpenCorrespondentProfile?: (path: string) => void;
  onRequestBack?: () => void;
  onThreadPresenceChange?: (conversationId: number | string, presence: string) => void;
  resolveChatPhotoUrl?: (source: string) => string | null;
  onPickChatPhoto?: () => Promise<File | null>;
  onLoadChatAccount?: () => Promise<MobileAccount>;
  onSaveChatPrivacy?: (privacy: Record<string, string | boolean>) => Promise<void>;
  onLoadConversations?: (offset: number) => Promise<ChatPageResult<Conversation>>;
  onLoadContacts?: (query: string, offset: number) => Promise<ChatPageResult<ChatContact>>;
  onStartConversation?: (recipientId: number | string, message: string) => Promise<Conversation>;
  onLoadChatFeatures?: () => Promise<ChatFeatures>;
  onLoadMessages?: (conversationId: number | string, offset: number) => Promise<MessagesResult>;
  onSendMessage?: (conversationId: number | string, message: string, photo?: File) => Promise<ChatDeliveryTransport>;
  onTyping?: (conversationId: number | string, isTyping: boolean) => Promise<void>;
  onLeaveConversation?: (conversationId: number | string) => Promise<void>;
  onDeleteConversation?: (conversationId: number | string) => Promise<void>;
  onReactToMessage?: (messageId: number | string, reaction: string) => Promise<void>;
  onDeleteMessage?: (messageId: number | string) => Promise<void>;
  onMarkSeen?: (conversationId: number | string) => Promise<void>;
  onOpenConversation?: (
    conversation: Conversation,
    events: {
      refresh: () => Promise<void>;
      setTyping: (typingNameList: string) => void;
      setSeen: (seenNameList: string) => void;
      setPresence: (online: boolean, lastSeen?: string) => void;
      setRealtimeStatus: (connected: boolean) => void;
      close: (reason?: string) => void;
    }
  ) => (() => void) | void;
};

export class ChatScreen {
  private activeThreadCleanup: (() => void) | null = null;
  private activeMessageActionsCleanup: (() => void) | null = null;
  private activeConversation: Conversation | null = null;
  private attachmentCleanup: (() => void) | null = null;
  private readonly drafts = new Map<string, { text: string; photo: File | null }>();
  private viewVersion = 0;

  constructor(
    private readonly content: HTMLElement,
    private readonly session: AuthSession,
    private readonly handlers: ChatScreenHandlers
  ) {}

  async render(): Promise<void> {
    ++this.viewVersion;
    this.cleanupActiveThread();
    this.activeConversation = null;
    this.handlers.onConversationModeChange?.(false);
    this.content.replaceChildren();
    const heading = element('div', 'section-heading-row chat-screen-heading');
    heading.append(title('Chat'));
    if (this.handlers.onLoadContacts && this.handlers.onStartConversation) {
      const compose = secondaryButton('New chat');
      compose.classList.add('compact-button');
      compose.addEventListener('click', () => void this.openCompose());
      heading.append(compose);
    }
    const settings = secondaryButton('Chat settings');
    settings.classList.add('compact-button');
    settings.addEventListener('click', () => void this.openChatSettings());
    heading.append(settings);
    this.content.append(heading);

    if (!this.handlers.onLoadConversations) {
      this.content.append(paragraph('Chat is not available in this build.'));
      return;
    }

    const list = element('div', 'conversation-list chat-conversation-list');
    list.append(paragraph('Loading chats…'));
    this.content.append(list);
    let offset = 0;
    let hasMore = false;
    const more = secondaryButton('Load more chats');
    more.hidden = true;
    this.content.append(more);

    const load = async (append = false): Promise<void> => {
      try {
        const page = await this.handlers.onLoadConversations!(offset);
        if (!append) list.replaceChildren();
        if (!append && page.items.length === 0) list.append(paragraph('No chats yet. Start a new chat.'));
        for (const conversation of page.items) list.append(this.conversationRow(conversation));
        hasMore = page.hasMore;
        more.hidden = !hasMore;
      } catch (error) {
        list.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load chats.'));
      }
    };
    more.addEventListener('click', () => { if (hasMore) { offset += 1; void load(true); } });
    await load();
  }

  private conversationRow(conversation: Conversation): HTMLButtonElement {
    const row = element('button', 'conversation-item chat-conversation-item');
    row.type = 'button';
    if (!conversation.seen) row.classList.add('is-unread');

    const avatar = element('span', 'conversation-avatar');
    const picture = this.handlers.resolveChatPhotoUrl?.(conversation.picture || (!conversation.multiple_recipients ? conversation.recipients?.[0]?.user_picture : '') || '');
    if (picture) {
      const img = document.createElement('img');
      img.src = picture;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => { avatar.replaceChildren(initials(String(conversation.name || conversation.name_list || 'Chat'))); }, { once: true });
      avatar.append(img);
    } else {
      avatar.textContent = initials(String(conversation.name || conversation.name_list || 'Chat'));
    }

    const copy = element('span', 'conversation-item__copy');
    const name = String(conversation.name || conversation.name_list || 'Conversation');
    copy.append(elementWithText('strong', name));
    const last = String(conversation.last_message?.message || conversation.last_message?.text || '');
    const secondary = last || (conversation.multiple_recipients
      ? `${conversation.recipients?.length ?? 0} participants`
      : conversation.user_is_online ? 'Online' : 'Open chat');
    copy.append(elementWithText('span', secondary));
    row.append(avatar, copy);
    row.addEventListener('click', () => void this.openConversation(conversation));
    return row;
  }

  openCompose(): Promise<void> {
    this.handlers.onOpenComposeRoute?.();
    return this.renderNewChat();
  }

  openConversation(conversation: Conversation): Promise<void> {
    this.handlers.onOpenThreadRoute?.(conversation);
    return this.renderConversation(conversation);
  }

  openConversationActions(): void {
    const conversation = this.activeConversation;
    if (!conversation) return;
    const { sheet, body, close } = this.createSettingsSheet('Conversation');
    const settings = secondaryButton('Chat settings');
    settings.addEventListener('click', () => { close(); void this.openChatSettings(); });
    body.append(settings);
    if (conversation.node_type === 'group' && conversation.link?.startsWith('groups/')) {
      const group = secondaryButton('View community group');
      group.addEventListener('click', () => { close(); this.handlers.onOpenCommunityGroups?.(`/${conversation.link}`); });
      body.append(group);
    }
    for (const [label, operation] of [
      ['Leave chat', this.handlers.onLeaveConversation],
      ['Remove from my inbox', this.handlers.onDeleteConversation]
    ] as const) {
      if (!operation) continue;
      const button = secondaryButton(label);
      button.addEventListener('click', () => {
        if (!window.confirm(`${label}?`)) return;
        const version = this.viewVersion;
        button.disabled = true;
        void operation(conversation.conversation_id)
          .then(() => { close(); if (version === this.viewVersion) this.handlers.onRequestBack?.(); })
          .catch((error: unknown) => { button.disabled = false; window.alert(error instanceof Error ? error.message : 'Unable to update chat.'); });
      });
      body.append(button);
    }
    this.content.append(sheet);
  }

  openConversationIdentity(): void {
    const conversation = this.activeConversation;
    if (!conversation) return;
    const group = Boolean(conversation.multiple_recipients || conversation.node_id);
    const recipient = group ? undefined : conversation.recipients?.[0];
    const name = group
      ? String(conversation.name || conversation.name_list || 'Community group')
      : String(conversation.name || conversation.name_list || recipient?.user_name || 'Chat member');
    const { sheet, body, close } = this.createSettingsSheet(group ? 'Group information' : 'Profile preview');
    const card = element('div', 'chat-profile-preview');
    const avatar = element('span', 'chat-profile-preview__avatar');
    const picture = this.handlers.resolveChatPhotoUrl?.(String(conversation.picture || recipient?.user_picture || ''));
    if (picture) {
      const image = document.createElement('img');
      image.src = picture;
      image.alt = '';
      image.addEventListener('error', () => { avatar.replaceChildren(initials(name)); }, { once: true });
      avatar.append(image);
    } else avatar.textContent = initials(name);
    const details = element('div', 'chat-profile-preview__details');
    details.append(elementWithText('strong', name));
    if (group) details.append(elementWithText('span', `${conversation.recipients?.length ?? 0} participants`));
    else {
      if (recipient?.user_name) details.append(elementWithText('span', `@${recipient.user_name}`));
      if (conversation.user_is_online || recipient?.user_is_online) details.append(elementWithText('small', 'Online'));
    }
    card.append(avatar, details);
    body.append(card);
    if (group) {
      const link = conversation.link;
      if (conversation.node_type === 'group' && link?.startsWith('groups/')) {
        const view = primaryButton('View community group');
        view.addEventListener('click', () => { close(); this.handlers.onOpenCommunityGroups?.(`/${link}`); });
        body.append(view);
      }
    } else {
      const path = chatProfilePath(recipient?.user_name);
      if (path && this.handlers.onOpenCorrespondentProfile) {
        const view = primaryButton('View full profile');
        view.addEventListener('click', () => { close(); this.handlers.onOpenCorrespondentProfile?.(path); });
        body.append(view);
      } else body.append(paragraph('The full profile is unavailable because this chat has no profile username.'));
    }
    this.content.append(sheet);
  }

  private createSettingsSheet(heading: string): { sheet: HTMLElement; body: HTMLElement; close: () => void } {
    this.content.querySelector('.chat-settings-sheet')?.remove();
    const sheet = element('div', 'chat-settings-sheet');
    const backdrop = element('button', 'chat-settings-sheet__backdrop');
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', 'Close settings');
    const panel = element('section', 'chat-settings-sheet__panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', heading);
    const header = element('div', 'chat-settings-sheet__header');
    const closeButton = secondaryButton('Close');
    const close = (): void => sheet.remove();
    closeButton.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    header.append(elementWithText('strong', heading), closeButton);
    const body = element('div', 'chat-settings-sheet__body');
    panel.append(header, body);
    sheet.append(backdrop, panel);
    return { sheet, body, close };
  }

  private async openChatSettings(): Promise<void> {
    const { sheet, body, close } = this.createSettingsSheet('Chat settings');
    const soundRow = element('label', 'chat-settings-row');
    const sound = document.createElement('input');
    sound.type = 'checkbox';
    sound.checked = isChatSoundEnabled(this.session.user.user_id);
    sound.addEventListener('change', () => {
      setChatSoundEnabled(this.session.user.user_id, sound.checked);
      if (sound.checked) unlockChatAudio(this.session.user.user_id);
    });
    soundRow.append(elementWithText('span', 'Message sounds on this device'), sound);
    body.append(soundRow);
    const serverSettings = element('div', 'chat-server-settings');
    serverSettings.append(paragraph('Loading chat privacy…'));
    const featuresStatus = element('div', 'chat-feature-status');
    body.append(serverSettings, featuresStatus);
    if (this.handlers.onLoadConversations && this.handlers.onDeleteConversation) {
      const clearRow = element('div', 'chat-server-settings');
      clearRow.append(elementWithText('strong', 'Chat history'));
      clearRow.append(paragraph('Remove all one-to-one chats from your inbox in one action. Group chats are unaffected. The site may permanently delete messages for everyone, depending on its settings.'));
      const clearButton = secondaryButton('Clear all direct chats');
      const clearStatus = element('p', 'chat-settings-status');
      clearStatus.setAttribute('aria-live', 'polite');
      clearButton.addEventListener('click', () => {
        if (!window.confirm('Clear all direct chats? Depending on site settings, messages may be permanently deleted for everyone. This cannot be undone.')) return;
        clearButton.disabled = true;
        clearStatus.textContent = 'Finding conversations…';
        const version = this.viewVersion;
        let completed = 0;
        void clearDirectChatHistory(
          (offset) => this.handlers.onLoadConversations!(offset),
          (id) => this.handlers.onDeleteConversation!(id),
          (done, total) => { completed = done; clearStatus.textContent = `Clearing ${done} of ${total} chats…`; }
        ).then(({ cleared }) => {
          close();
          if (version === this.viewVersion) {
            if (this.activeConversation) this.handlers.onRequestBack?.();
            else void this.render();
          }
          window.alert(cleared ? `${cleared} chats removed from your inbox.` : 'There are no direct chats to clear.');
        }).catch((error: unknown) => {
          clearStatus.textContent = `${completed} chats removed. ${error instanceof Error ? error.message : 'Unable to finish clearing chats.'}`;
          clearButton.disabled = false;
        });
      });
      clearRow.append(clearButton, clearStatus);
      body.append(clearRow);
    }
    this.content.append(sheet);
    if (this.handlers.onLoadChatFeatures) {
      void this.handlers.onLoadChatFeatures().then((features) => {
        if (!sheet.isConnected) return;
        featuresStatus.replaceChildren(elementWithText('strong', 'Site chat features'));
        for (const [label, enabled] of [
          ['Photo messages', features.photos], ['Typing indicators', features.typing],
          ['Read receipts', features.seen], ['Live messaging', features.realtime]
        ] as Array<[string, boolean]>) {
          featuresStatus.append(paragraph(`${label}: ${enabled ? 'Available' : 'Disabled by site settings'}`));
        }
      }).catch(() => { /* Local sound and privacy settings remain usable. */ });
    }
    if (!this.handlers.onLoadChatAccount || !this.handlers.onSaveChatPrivacy) {
      serverSettings.replaceChildren(paragraph('Chat privacy settings are unavailable in this build.'));
      return;
    }
    try {
      const account = await this.handlers.onLoadChatAccount();
      if (!sheet.isConnected) return;
      const privacy = account.privacy ?? {};
      const enabledRow = element('label', 'chat-settings-row');
      const enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.checked = privacy.user_chat_enabled === true || privacy.user_chat_enabled === '1';
      enabledRow.append(elementWithText('span', 'Allow people to chat with me'), enabled);
      const audienceRow = element('label', 'chat-settings-row');
      audienceRow.append(elementWithText('span', 'Who can chat with me'));
      const audience = document.createElement('select');
      for (const [value, label] of [['public', 'Everyone'], ['friends', 'Friends'], ['me', 'Only me']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        audience.append(option);
      }
      audience.value = String(privacy.user_privacy_chat || 'public');
      audienceRow.append(audience);
      const save = primaryButton('Save chat privacy');
      const status = element('p', 'chat-settings-status');
      save.addEventListener('click', () => {
        save.disabled = true;
        status.textContent = 'Saving…';
        void this.handlers.onSaveChatPrivacy!({
          ...privacy, user_chat_enabled: enabled.checked, user_privacy_chat: audience.value
        }).then(() => { status.textContent = 'Chat privacy saved.'; })
          .catch((error: unknown) => { status.textContent = error instanceof Error ? error.message : 'Unable to save chat privacy.'; })
          .finally(() => { save.disabled = false; });
      });
      serverSettings.replaceChildren(enabledRow, audienceRow, save, status);
    } catch (error) {
      if (sheet.isConnected) serverSettings.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load chat privacy.'));
    }
  }

  private async renderNewChat(): Promise<void> {
    ++this.viewVersion;
    this.cleanupActiveThread();
    this.activeConversation = null;
    this.handlers.onConversationModeChange?.(false);
    this.content.replaceChildren();
    const header = element('div', 'conversation-header');
    const back = secondaryButton('Back');
    back.classList.add('compact-button');
    back.addEventListener('click', () => this.handlers.onRequestBack?.());
    header.append(back, title('New chat'));
    this.content.append(header, paragraph('Select one person for a direct chat. Community group chats are managed in Groups.'));
    if (this.handlers.onOpenCommunityGroups) {
      const groups = secondaryButton('Browse community groups');
      groups.addEventListener('click', () => this.handlers.onOpenCommunityGroups?.('/groups'));
      this.content.append(groups);
    }

    if (!this.handlers.onLoadContacts || !this.handlers.onStartConversation) {
      this.content.append(paragraph('Starting new chats is unavailable.'));
      return;
    }

    const selected = new Map<string, ChatContact>();
    const chips = element('div', 'selected-contact-chips');
    chips.hidden = true;
    this.content.append(chips);

    const searchForm = document.createElement('form');
    searchForm.className = 'contact-search';
    const query = document.createElement('input');
    query.type = 'search';
    query.placeholder = 'Search contacts';
    const search = primaryButton('Search');
    search.type = 'submit';
    searchForm.append(query, search);
    this.content.append(searchForm);

    const results = element('div', 'contact-list');
    this.content.append(results);

    const composer = document.createElement('form');
    composer.className = 'initial-message-form group-message-form';
    composer.hidden = true;
    const text = document.createElement('textarea');
    text.rows = 3;
    text.placeholder = 'Write the first message…';
    const send = primaryButton('Start chat');
    send.type = 'submit';
    composer.append(text, send);
    this.content.append(composer);

    let offset = 0;
    let hasMore = false;
    const more = secondaryButton('Load more contacts');
    more.hidden = true;
    this.content.append(more);

    const refreshSelected = (): void => {
      chips.replaceChildren();
      chips.hidden = selected.size === 0;
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
        chips.append(chip);
      }
      send.textContent = 'Start chat';
    };

    const loadContacts = async (append = false): Promise<void> => {
      try {
        const page = await this.handlers.onLoadContacts!(query.value.trim(), offset);
        if (!append) results.replaceChildren();
        if (!append && page.items.length === 0) results.append(paragraph('No matching contacts.'));
        hasMore = page.hasMore;
        more.hidden = !hasMore;

        for (const contact of page.items) {
          const id = String(contact.user_id);
          const row = element('button', 'contact-item selectable-contact');
          row.type = 'button';
          row.classList.toggle('is-selected', selected.has(id));

          const avatar = element('span', 'contact-avatar');
          const contactPicture = this.handlers.resolveChatPhotoUrl?.(contact.user_picture || '');
          if (contactPicture) {
            const avatarImage = document.createElement('img');
            avatarImage.src = contactPicture;
            avatarImage.alt = '';
            avatarImage.loading = 'lazy';
            avatarImage.addEventListener('error', () => {
              avatar.replaceChildren(initials(String(contact.user_fullname || contact.user_firstname || contact.user_name || 'User')));
            }, { once: true });
            avatar.append(avatarImage);
          } else {
            const fallbackName = String(contact.user_fullname || contact.user_firstname || contact.user_name || 'User');
            avatar.textContent = initials(fallbackName);
          }
          row.append(avatar);

          const copy = element('span', 'contact-item__copy');
          const name = String(contact.user_fullname || contact.user_firstname || contact.user_name || `User ${contact.user_id}`);
          copy.append(elementWithText('strong', name));
          if (contact.user_name) copy.append(elementWithText('span', `@${String(contact.user_name)}`));
          copy.append(elementWithText('small', contact.user_is_online ? 'Online' : (contact.user_last_seen ? `Last seen ${String(contact.user_last_seen)}` : '')));
          const marker = elementWithText('span', selected.has(id) ? '✓' : '+');
          marker.className = 'contact-select-marker';
          row.append(copy, marker);
          row.addEventListener('click', () => {
            if (selected.has(id)) selected.delete(id); else { selected.clear(); selected.set(id, contact); }
            refreshSelected();
            void loadContacts();
          });
          results.append(row);
        }
      } catch (error) {
        results.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load contacts.'));
      }
    };

    searchForm.addEventListener('submit', (event) => { event.preventDefault(); offset = 0; void loadContacts(); });
    more.addEventListener('click', () => { if (hasMore) { offset += 1; void loadContacts(true); } });
    composer.addEventListener('submit', (event) => {
      event.preventDefault();
      const message = text.value.trim();
      const ids = [...selected.values()].map((contact) => contact.user_id);
      if (!message || ids.length === 0) return;
      send.disabled = true;
      send.textContent = 'Starting…';
      void this.handlers.onStartConversation!(ids[0], message)
        .then((conversation) => this.openConversation(conversation))
        .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to start chat.'))
        .finally(() => { send.disabled = false; refreshSelected(); });
    });

    await loadContacts();
  }

  private async renderConversation(conversation: Conversation): Promise<void> {
    const version = ++this.viewVersion;
    this.cleanupActiveThread();
    this.activeConversation = conversation;
    this.handlers.onConversationModeChange?.(true);
    const conversationId = conversation.conversation_id;
    const updateHeaderPresence = (presence: string): void => {
      if (version === this.viewVersion) this.handlers.onThreadPresenceChange?.(conversationId, presence);
    };
    this.content.replaceChildren();

    const presence = element('p', 'conversation-presence');
    presence.hidden = true;
    presence.textContent = conversation.multiple_recipients
      ? `${conversation.recipients?.length ?? 0} participants`
      : conversation.user_is_online ? 'Online' : conversation.user_last_seen ? `Last seen ${conversation.user_last_seen}` : '';
    let normalPresence = presence.textContent;
    updateHeaderPresence(presence.textContent);
    const realtimeStatus = element('p', 'conversation-realtime-status');
    realtimeStatus.textContent = 'Connecting to live chat…';
    const deliveryStatus = element('p', 'conversation-delivery-status');
    deliveryStatus.setAttribute('aria-live', 'polite');
    this.content.append(presence, realtimeStatus, deliveryStatus);

    const loadOlder = secondaryButton('Load older messages');
    loadOlder.hidden = true;
    this.content.append(loadOlder);
    const thread = element('div', 'message-thread');
    thread.append(paragraph('Loading messages…'));
    this.content.append(thread);

    if (!this.handlers.onLoadMessages) {
      thread.replaceChildren(paragraph('Message loading is unavailable.'));
      return;
    }

    const composer = document.createElement('form');
    composer.className = 'message-composer';
    const attach = secondaryButton('Photo');
    attach.classList.add('compact-button', 'attach-button');
    const photo = document.createElement('input');
    photo.type = 'file';
    photo.accept = 'image/*';
    photo.hidden = true;
    const attachment = element('div', 'chat-attachment-preview');
    attachment.hidden = true;
    const attachmentImage = document.createElement('img');
    attachmentImage.alt = 'Selected photo';
    const attachmentName = element('span', 'chat-attachment-preview__name');
    const attachmentHint = elementWithText('span', 'Add a caption below, or send the photo on its own.');
    attachmentHint.className = 'chat-attachment-preview__hint';
    const attachmentDetails = element('div', 'chat-attachment-preview__details');
    attachmentDetails.append(attachmentName, attachmentHint);
    const removeAttachment = secondaryButton('Remove');
    removeAttachment.type = 'button';
    attachment.append(attachmentImage, attachmentDetails, removeAttachment);
    let selectedPhoto: File | null = null;
    let previewUrl: string | null = null;
    const clearAttachment = (): void => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      selectedPhoto = null;
      photo.value = '';
      attachment.hidden = true;
      attachmentImage.removeAttribute('src');
      text.placeholder = 'Write a message…';
      send.setAttribute('aria-label', 'Send message');
    };
    const showAttachment = (file: File): void => {
      if (!file.type.startsWith('image/')) { window.alert('Choose an image file to attach.'); return; }
      clearAttachment();
      selectedPhoto = file;
      previewUrl = URL.createObjectURL(file);
      attachmentImage.src = previewUrl;
      attachmentName.textContent = file.name;
      attachment.hidden = false;
      text.placeholder = 'Add a caption (optional)…';
      send.setAttribute('aria-label', 'Send message and photo');
    };
    this.attachmentCleanup = clearAttachment;
    removeAttachment.addEventListener('click', clearAttachment);
    photo.addEventListener('change', () => { const file = photo.files?.[0]; if (file) showAttachment(file); });
    attach.addEventListener('click', () => {
      if (!this.handlers.onPickChatPhoto) { photo.click(); return; }
      void this.handlers.onPickChatPhoto()
        .then((file) => { if (file && version === this.viewVersion) showAttachment(file); })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          if (!/cancel|OS-PLUG-CAMR-0020/i.test(message)) window.alert(message || 'Unable to select a photo.');
        });
    });
    const text = document.createElement('textarea');
    text.rows = 2;
    text.placeholder = 'Write a message…';
    text.setAttribute('aria-label', 'Message or photo caption');
    const savedDraft = this.drafts.get(String(conversationId));
    if (savedDraft) text.value = savedDraft.text;
    const send = primaryButton('');
    send.type = 'submit';
    send.classList.add('message-send-button');
    send.setAttribute('aria-label', 'Send message');
    send.innerHTML = '<span class="message-send-button__icon" aria-hidden="true"></span>';
    composer.append(attach, text, photo, send);
    this.content.append(attachment, composer);
    if (savedDraft?.photo) showAttachment(savedDraft.photo);
    if (this.handlers.onLoadChatFeatures) {
      void this.handlers.onLoadChatFeatures().then((features) => {
        if (version !== this.viewVersion || features.photos) return;
        attach.disabled = true;
        attach.title = 'Photo messages are disabled by site settings.';
        if (selectedPhoto) clearAttachment();
      }).catch(() => undefined);
    }

    let typingTimer: number | undefined;
    let typingActive = false;
    const setTyping = (typing: boolean): void => {
      if (typingActive === typing) return;
      typingActive = typing;
      if (this.handlers.onTyping) void this.handlers.onTyping(conversationId, typing).catch(() => undefined);
    };
    text.addEventListener('input', () => {
      setTyping(true);
      if (typingTimer) window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => setTyping(false), 1200);
    });
    text.addEventListener('blur', () => setTyping(false));

    let historyOffset = 0;
    let hasMoreHistory = false;
    let hasLoadedHistory = false;
    let loadingOlder = false;
    let renderedMessages: Message[] = [];
    let pendingBubble: HTMLDivElement | null = null;
    let lastMarkedIncomingId: string | null = null;
    let receiptMessageId: string | null = null;
    const renderReceipt = (seenNameList: string): void => {
      const receipt = thread.querySelector<HTMLElement>('.chat-message-receipt');
      if (!receipt || !receiptMessageId) return;
      const seen = !conversation.multiple_recipients && !conversation.node_id && Boolean(seenNameList.trim());
      receipt.textContent = seen ? '✓✓ Seen' : '✓ Sent';
      receipt.setAttribute('aria-label', seen ? `Seen by ${seenNameList}` : 'Sent');
      receipt.classList.toggle('is-seen', seen);
    };
    const refresh = async (older = false): Promise<void> => {
      if (older && (loadingOlder || !hasMoreHistory)) return;
      if (older) loadingOlder = true;
      try {
        const nextOffset = older ? historyOffset + 1 : 0;
        const result = await this.handlers.onLoadMessages!(conversationId, nextOffset);
        if (version !== this.viewVersion) return;
        const messages = result.messages ?? [];
        normalPresence = conversation.multiple_recipients
          ? `${conversation.recipients?.length ?? 0} participants`
          : result.user_is_online ? 'Online'
          : result.user_last_seen ? `Last seen ${String(result.user_last_seen)}` : normalPresence;
        presence.textContent = result.typing_name_list ? `${result.typing_name_list} typing…` : normalPresence;
        updateHeaderPresence(presence.textContent);
        if (older || !hasLoadedHistory) hasMoreHistory = Boolean(result.has_more);
        loadOlder.hidden = !hasMoreHistory;

        const stickToBottom = !hasLoadedHistory || (!older && thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80);
        const topEdge = thread.getBoundingClientRect().top;
        const anchor = !stickToBottom || older
          ? [...thread.querySelectorAll<HTMLDivElement>('.message-bubble[data-message-id]')]
            .find((bubble) => bubble.getBoundingClientRect().bottom > topEdge)
          : undefined;
        const anchorId = anchor?.dataset.messageId;
        const anchorTop = anchor?.getBoundingClientRect().top;
        const previousTop = thread.scrollTop;
        const existing = new Map([...thread.querySelectorAll<HTMLDivElement>('.message-bubble[data-message-id]')]
          .map((bubble) => [bubble.dataset.messageId!, bubble]));
        renderedMessages = mergeChatHistory(renderedMessages, messages, older);

        const latestReceipt = !older ? latestOutgoingReceipt(messages, this.session.user.user_id, conversation, result.seen_name_list) : null;
        receiptMessageId = !older ? latestReceipt?.messageId ?? null : receiptMessageId;
        if (!older) thread.querySelector('.chat-message-receipt')?.remove();
        const latestIds = new Set(messages.map((message) => String(message.message_id)));
        const bubbles = renderedMessages.map((message) => {
          const id = String(message.message_id);
          return (!older && latestIds.has(id) ? undefined : existing.get(id)) ?? this.messageBubble(message, refresh);
        });
        if (latestReceipt) {
          const marker = element('small', 'chat-message-receipt');
          bubbles.find((bubble) => bubble.dataset.messageId === latestReceipt.messageId)?.append(marker);
        }
        thread.replaceChildren(...bubbles);
        if (!renderedMessages.length) thread.append(paragraph('No messages yet.'));
        if (pendingBubble) thread.append(pendingBubble);
        if (anchorId && anchorTop !== undefined) {
          const newAnchor = bubbles.find((bubble) => bubble.dataset.messageId === anchorId);
          thread.scrollTop = newAnchor ? previousTop + newAnchor.getBoundingClientRect().top - anchorTop : previousTop;
        } else if (stickToBottom && !older) {
          thread.scrollTop = thread.scrollHeight;
        } else {
          thread.scrollTop = previousTop;
        }
        if (older) historyOffset = nextOffset;
        hasLoadedHistory = true;
        if (!older) renderReceipt(String(result.seen_name_list ?? ''));

        const latestIncoming = [...messages].reverse().find((message) =>
          String(message.user_id ?? message.sender_id ?? '') !== String(this.session.user.user_id));
        const incomingId = latestIncoming?.message_id === undefined ? null : String(latestIncoming.message_id);
        if (!older && incomingId && incomingId !== lastMarkedIncomingId && this.handlers.onMarkSeen) {
          lastMarkedIncomingId = incomingId;
          void this.handlers.onMarkSeen(conversationId).catch(() => { lastMarkedIncomingId = null; });
        }

      } catch (error) {
        if (!older && !hasLoadedHistory) {
          thread.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load messages.'));
          if (pendingBubble) thread.append(pendingBubble);
        } else if (version === this.viewVersion) {
          deliveryStatus.textContent = error instanceof Error ? error.message : 'Unable to refresh messages.';
        }
      } finally {
        if (older) loadingOlder = false;
      }
    };
    const latestResync = new CoalescedResync(() => refresh(false));


    let threadClosed = false;
    const closeThread = (reason?: string): void => {
      if (threadClosed || version !== this.viewVersion) return;
      threadClosed = true;
      if (reason) window.alert(reason);
      this.handlers.onRequestBack?.();
    };
    const realtimeHandlers: Parameters<NonNullable<ChatScreenHandlers['onOpenConversation']>>[1] = {
      refresh: () => latestResync.request(),
      setTyping: (typingNameList) => {
        if (version !== this.viewVersion) return;
        presence.textContent = typingNameList ? `${typingNameList} typing…` : normalPresence;
        updateHeaderPresence(presence.textContent);
      },
      setSeen: (seenNameList) => {
        if (version !== this.viewVersion) return;
        renderReceipt(seenNameList);
      },
      setPresence: (online, lastSeen) => {
        if (version !== this.viewVersion) return;
        if (conversation.multiple_recipients) return;
        normalPresence = online ? 'Online' : lastSeen ? `Last seen ${lastSeen}` : '';
        presence.textContent = normalPresence;
        updateHeaderPresence(presence.textContent);
      },
      setRealtimeStatus: (connected) => {
        if (version !== this.viewVersion) return;
        realtimeStatus.textContent = connected ? 'Live chat connected' : 'Standard delivery';
        realtimeStatus.classList.toggle('is-live', connected);
      },
      close: closeThread
    };
    const stopRealtime = this.handlers.onOpenConversation?.(conversation, realtimeHandlers);

    const leaveThread = (): void => {
      if (text.value || selectedPhoto) this.drafts.set(String(conversationId), { text: text.value, photo: selectedPhoto });
      else this.drafts.delete(String(conversationId));
      if (typingTimer) window.clearTimeout(typingTimer);
      setTyping(false);
      stopRealtime?.();
    };
    this.activeThreadCleanup = leaveThread;

    loadOlder.addEventListener('click', () => void refresh(true));
    composer.addEventListener('submit', (event) => {
      event.preventDefault();
      const message = text.value.trim();
      if ((!message && !selectedPhoto) || !this.handlers.onSendMessage) return;
      unlockChatAudio(this.session.user.user_id);
      pendingBubble = element('div', 'message-bubble is-mine is-pending');
      if (selectedPhoto && previewUrl) {
        const pendingImage = document.createElement('img');
        pendingImage.className = 'message-photo';
        pendingImage.src = previewUrl;
        pendingImage.alt = 'Photo being sent';
        pendingBubble.append(pendingImage);
      }
      if (message) pendingBubble.append(elementWithText('div', message));
      pendingBubble.append(elementWithText('small', 'Sending…'));
      thread.append(pendingBubble);
      thread.scrollTop = thread.scrollHeight;
      send.disabled = true;
      attach.disabled = true;
      text.disabled = true;
      send.classList.add('is-sending');
      send.setAttribute('aria-label', 'Sending message');
      setTyping(false);
      void this.handlers.onSendMessage(conversationId, message, selectedPhoto ?? undefined)
        .then(async (transport) => {
          pendingBubble?.remove();
          pendingBubble = null;
          deliveryStatus.textContent = transport === 'realtime'
            ? 'Last message sent via live chat'
            : 'Last message sent via standard delivery';
          text.value = '';
          clearAttachment();
          this.drafts.delete(String(conversationId));
          playSentChatSound(this.session.user.user_id);
          await refresh();
        })
        .catch(async (error: unknown) => {
          pendingBubble?.remove();
          pendingBubble = null;
          if (error instanceof RealtimeDeliveryUncertainError) {
            await latestResync.request().catch(() => undefined);
            window.alert('Delivery could not be confirmed. The conversation was refreshed; check whether your message appears before retrying.');
            return;
          }
          window.alert(error instanceof Error ? error.message : 'Unable to send message.');
        })
        .finally(() => {
          send.disabled = false;
          attach.disabled = false;
          text.disabled = false;
          send.classList.remove('is-sending');
          send.setAttribute('aria-label', 'Send message');
          send.innerHTML = '<span class="message-send-button__icon" aria-hidden="true"></span>';
        });
    });

    await refresh();
  }


  deactivate(): void {
    ++this.viewVersion;
    this.cleanupActiveThread();
    this.activeConversation = null;
    this.handlers.onConversationModeChange?.(false);
  }

  private cleanupActiveThread(): void {
    this.activeMessageActionsCleanup?.();
    this.activeMessageActionsCleanup = null;
    const cleanup = this.activeThreadCleanup;
    this.activeThreadCleanup = null;
    cleanup?.();
    this.attachmentCleanup?.();
    this.attachmentCleanup = null;
  }

  private messageBubble(message: Message, refresh: () => Promise<void>): HTMLDivElement {
    const bubble = element('div', 'message-bubble');
    if (message.message_id != null) bubble.dataset.messageId = String(message.message_id);
    const senderId = String(message.user_id ?? message.sender_id ?? '');
    const mine = senderId && senderId === String(this.session.user.user_id ?? '');
    if (mine) bubble.classList.add('is-mine');

    const body = String(message.message ?? '');
    const photoUrl = this.handlers.resolveChatPhotoUrl?.(message.image || message.photo || '');
    if (photoUrl) {
      const image = document.createElement('img');
      image.className = 'message-photo';
      image.src = photoUrl;
      image.alt = 'Shared photo';
      image.loading = 'lazy';
      bubble.append(image);
    }
    if (body) {
      const caption = elementWithText('div', body);
      caption.className = 'chat-message-text';
      bubble.append(caption);
    }
    if (!body && !photoUrl) bubble.append(elementWithText('div', 'Attachment'));
    if (message.time) bubble.append(elementWithText('small', String(message.time)));

    if (message.i_reaction) {
      const emoji = reactionChoices.find((choice) => choice.value === message.i_reaction)?.emoji;
      if (emoji) bubble.append(elementWithText('small', `${emoji} Your reaction`));
    }
    if (message.message_id && (this.handlers.onReactToMessage || (mine && this.handlers.onDeleteMessage))) {
      this.installMessageActions(bubble, message.message_id, Boolean(mine), refresh);
    }
    return bubble;
  }

  private installMessageActions(
    bubble: HTMLDivElement,
    messageId: number | string,
    mine: boolean,
    refresh: () => Promise<void>
  ): void {
    bubble.tabIndex = 0;
    bubble.setAttribute('aria-label', 'Message. Long press for actions.');
    let timer: number | undefined;
    let startX = 0;
    let startY = 0;
    const cancel = (): void => { if (timer) window.clearTimeout(timer); timer = undefined; };
    const show = (): void => {
      cancel();
      this.activeMessageActionsCleanup?.();
      const backdrop = element('div', 'message-actions-backdrop');
      const menu = element('div', 'message-actions-menu');
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-label', 'Message actions');
      const close = (): void => {
        backdrop.remove();
        menu.remove();
        document.removeEventListener('keydown', onEscape);
        if (this.activeMessageActionsCleanup === close) this.activeMessageActionsCleanup = null;
      };
      const onEscape = (event: KeyboardEvent): void => { if (event.key === 'Escape') close(); };
      backdrop.addEventListener('click', close);
      document.addEventListener('keydown', onEscape);
      for (const choice of reactionChoices) {
        if (!this.handlers.onReactToMessage) break;
        const button = secondaryButton(`${choice.emoji} ${choice.label}`);
        button.classList.add('message-actions-menu__reaction');
        button.addEventListener('click', () => {
          close();
          void this.handlers.onReactToMessage!(messageId, choice.value)
            .then(() => refresh())
            .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to react.'));
        });
        menu.append(button);
      }
      if (mine && this.handlers.onDeleteMessage) {
        const remove = secondaryButton('Delete message');
        remove.classList.add('message-actions-menu__delete');
        remove.addEventListener('click', () => {
          close();
          if (!window.confirm('Delete this message?')) return;
          void this.handlers.onDeleteMessage!(messageId)
            .then(() => refresh())
            .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to delete message.'));
        });
        menu.append(remove);
      }
      document.body.append(backdrop, menu);
      this.activeMessageActionsCleanup = close;
      const rect = bubble.getBoundingClientRect();
      menu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 12))}px`;
      menu.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - menu.offsetHeight - 12))}px`;
      menu.querySelector<HTMLButtonElement>('button')?.focus();
    };
    bubble.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      cancel();
      startX = event.clientX;
      startY = event.clientY;
      timer = window.setTimeout(show, 500);
    });
    bubble.addEventListener('pointermove', (event) => {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
    });
    bubble.addEventListener('pointerup', cancel);
    bubble.addEventListener('pointercancel', cancel);
    bubble.addEventListener('pointerleave', cancel);
    bubble.addEventListener('contextmenu', (event) => { event.preventDefault(); show(); });
    bubble.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        show();
      }
    });
  }
}

const reactionChoices = [
  { value: 'like', label: 'Like', emoji: '👍' },
  { value: 'love', label: 'Love', emoji: '❤️' },
  { value: 'haha', label: 'Haha', emoji: '😆' },
  { value: 'yay', label: 'Yay', emoji: '🙌' },
  { value: 'wow', label: 'Wow', emoji: '😮' },
  { value: 'sad', label: 'Sad', emoji: '😢' },
  { value: 'angry', label: 'Angry', emoji: '😠' }
] as const;

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
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

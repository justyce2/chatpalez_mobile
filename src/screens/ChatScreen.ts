import type { ChatContact, ChatFeatures, Conversation, Message, MessagesResult } from '../api/chat';
import type { AuthSession } from '../auth/session';
import { CoalescedResync } from '../chat-resync';
import { RealtimeDeliveryUncertainError } from '../chat-realtime';
import { isChatSoundEnabled, playSentChatSound, setChatSoundEnabled, unlockChatAudio } from '../chat-sound';
import { latestOutgoingReceipt } from '../chat-receipts';
import { mergeChatHistory } from '../chat-history';
import { clearDirectChatHistory } from '../chat-clear';
import { chatProfilePath } from '../chat-profile-route';
import { chatMessageText } from '../chat-message-text';
import { canForwardMessage, displayChatMessage, forwardedText } from '../chat-forward';
import type { MobileAccount } from '../api/user';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { saveChatPhoto } from '../chat-photo-save';

export type ChatPageResult<T> = { items: T[]; hasMore: boolean };
export type ChatDeliveryTransport = 'realtime' | 'http';
export type ChatSelectionState = { count: number; canForward: boolean; canDelete: boolean; canCopy: boolean };

export type ChatScreenHandlers = {
  onConversationModeChange?: (active: boolean) => void;
  onOpenThreadRoute?: (conversation: Conversation) => void;
  onOpenComposeRoute?: () => void;
  onOpenCommunityGroups?: (path: string) => void;
  onOpenCorrespondentProfile?: (path: string) => void;
  onRequestBack?: () => void;
  onThreadPresenceChange?: (conversationId: number | string, presence: string) => void;
  onSelectionChange?: (selection: ChatSelectionState | null) => void;
  resolveChatPhotoUrl?: (source: string) => string | null;
  onPickChatPhoto?: () => Promise<File | null>;
  onChatSoundChange?: (enabled: boolean) => void;
  onLoadChatAccount?: () => Promise<MobileAccount>;
  onSaveChatPrivacy?: (privacy: Record<string, string | boolean>) => Promise<void>;
  onLoadConversations?: (offset: number) => Promise<ChatPageResult<Conversation>>;
  onLoadContacts?: (query: string, offset: number) => Promise<ChatPageResult<ChatContact>>;
  onStartConversation?: (recipientId: number | string, message: string) => Promise<Conversation>;
  onForwardMessage?: (target: { conversationId?: number | string; recipientId?: number | string }, message: string, photo: string) => Promise<Conversation>;
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
  private activeImagePreviewCleanup: (() => void) | null = null;
  private activeConversation: Conversation | null = null;
  private attachmentCleanup: (() => void) | null = null;
  private readonly selectedMessages = new Map<string, Message>();
  private selectionThread: HTMLElement | null = null;
  private selectedRefresh: (() => Promise<void>) | null = null;
  private forwardPickerCleanup: (() => void) | null = null;
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
    const lastMessage = conversation.last_message;
    const last = lastMessage ? chatMessageText({
      message: typeof lastMessage.message === 'string' ? lastMessage.message : String(lastMessage.text ?? ''),
      message_orginal: typeof lastMessage.message_orginal === 'string' ? lastMessage.message_orginal : undefined,
      message_orginal_decoded: typeof lastMessage.message_orginal_decoded === 'string' ? lastMessage.message_orginal_decoded : undefined
    }) : '';
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
      this.handlers.onChatSoundChange?.(sound.checked);
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
    this.content.append(presence);

    const loadOlder = secondaryButton('Load older messages');
    loadOlder.hidden = true;
    const thread = element('div', 'message-thread');
    thread.append(loadOlder, paragraph('Loading messages…'));
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
    attachmentImage.addEventListener('error', () => {
      attachmentImage.hidden = true;
      attachmentHint.textContent = 'Photo selected. Preview unavailable; you can still add a caption and send.';
    });
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
    let photosAvailable = true;
    const clearAttachment = (): void => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      selectedPhoto = null;
      photo.value = '';
      attachment.hidden = true;
      attachmentImage.hidden = false;
      attachmentImage.removeAttribute('src');
      text.placeholder = 'Write a message…';
      send.setAttribute('aria-label', 'Send message');
    };
    const showAttachment = (file: File): void => {
      if (!file.type.startsWith('image/')) { window.alert('Choose an image file to attach.'); return; }
      if (file.size > 8 * 1024 * 1024) { window.alert('This photo is too large. Choose a smaller image.'); return; }
      clearAttachment();
      selectedPhoto = file;
      previewUrl = URL.createObjectURL(file);
      attachmentImage.src = previewUrl;
      attachmentName.textContent = file.name;
      attachmentHint.textContent = 'Add a caption below, or send the photo on its own.';
      attachment.hidden = false;
      text.placeholder = 'Add a caption (optional)…';
      send.setAttribute('aria-label', 'Send message and photo');
    };
    this.attachmentCleanup = clearAttachment;
    removeAttachment.addEventListener('click', clearAttachment);
    photo.addEventListener('change', () => { const file = photo.files?.[0]; if (file) showAttachment(file); });
    attach.addEventListener('click', () => {
      if (!this.handlers.onPickChatPhoto) { photo.click(); return; }
      attach.disabled = true;
      attach.textContent = 'Preparing…';
      void this.handlers.onPickChatPhoto()
        .then((file) => { if (file && version === this.viewVersion && photosAvailable) showAttachment(file); })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          if (!/cancel|OS-PLUG-CAMR-0020/i.test(message)) window.alert(message || 'Unable to select a photo.');
        }).finally(() => {
          if (version === this.viewVersion) {
            attach.textContent = 'Photo';
            attach.disabled = !photosAvailable;
          }
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
    this.content.append(realtimeStatus, deliveryStatus, attachment, composer);
    if (savedDraft?.photo) showAttachment(savedDraft.photo);
    if (this.handlers.onLoadChatFeatures) {
      void this.handlers.onLoadChatFeatures().then((features) => {
        if (version !== this.viewVersion || features.photos) return;
        photosAvailable = false;
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
    let previousScrollTop = 0;
    let touchStartY = 0;
    let requestedHistory = false;
    const updateHistoryControl = (): void => {
      loadOlder.hidden = !hasMoreHistory || !requestedHistory || thread.scrollTop > 64 || loadingOlder;
    };
    thread.addEventListener('scroll', () => {
      const current = thread.scrollTop;
      if (current > previousScrollTop + 2 || current > 64) requestedHistory = false;
      else if (current < previousScrollTop - 2 && current <= 64) requestedHistory = true;
      previousScrollTop = current;
      updateHistoryControl();
    }, { passive: true });
    thread.addEventListener('wheel', (event) => {
      if (event.deltaY < 0 && thread.scrollTop <= 64) {
        requestedHistory = true;
        updateHistoryControl();
      }
    }, { passive: true });
    thread.addEventListener('touchstart', (event) => { touchStartY = event.touches[0]?.clientY ?? 0; }, { passive: true });
    thread.addEventListener('touchmove', (event) => {
      if ((event.touches[0]?.clientY ?? 0) - touchStartY > 20 && thread.scrollTop <= 64) {
        requestedHistory = true;
        updateHistoryControl();
      }
    }, { passive: true });
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
        updateHistoryControl();

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
        thread.replaceChildren(loadOlder, ...bubbles);
        if (this.selectedMessages.size) this.updateSelection();
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
        if (older) requestedHistory = false;
        previousScrollTop = thread.scrollTop;
        updateHistoryControl();
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
        if (older) {
          loadingOlder = false;
          updateHistoryControl();
        }
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

    loadOlder.addEventListener('click', () => {
      requestedHistory = false;
      updateHistoryControl();
      void refresh(true);
    });
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
      if (selectedPhoto) attachment.hidden = true;
      thread.scrollTop = thread.scrollHeight;
      send.disabled = true;
      attach.disabled = true;
      text.disabled = true;
      send.classList.add('is-sending');
      send.setAttribute('aria-label', 'Sending message');
      setTyping(false);
      void this.handlers.onSendMessage(conversationId, message, selectedPhoto ?? undefined)
        .then(async () => {
          pendingBubble?.remove();
          pendingBubble = null;
          deliveryStatus.textContent = '';
          text.value = '';
          clearAttachment();
          this.drafts.delete(String(conversationId));
          playSentChatSound(this.session.user.user_id);
          await refresh();
        })
        .catch(async (error: unknown) => {
          pendingBubble?.remove();
          pendingBubble = null;
          if (selectedPhoto) attachment.hidden = false;
          if (error instanceof RealtimeDeliveryUncertainError) {
            await latestResync.request().catch(() => undefined);
            window.alert('Delivery could not be confirmed. The conversation was refreshed; check whether your message appears before retrying.');
            return;
          }
          window.alert(error instanceof Error ? error.message : 'Unable to send message.');
        })
        .finally(() => {
          send.disabled = false;
          attach.disabled = !photosAvailable;
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
    this.forwardPickerCleanup?.();
    this.forwardPickerCleanup = null;
    this.dismissSelection();
    this.activeImagePreviewCleanup?.();
    this.activeImagePreviewCleanup = null;
    this.activeMessageActionsCleanup?.();
    this.activeMessageActionsCleanup = null;
    const cleanup = this.activeThreadCleanup;
    this.activeThreadCleanup = null;
    cleanup?.();
    this.attachmentCleanup?.();
    this.attachmentCleanup = null;
  }

  dismissSelection(): boolean {
    if (!this.selectedMessages.size && !this.selectionThread) return false;
    this.selectedMessages.clear();
    this.activeMessageActionsCleanup?.();
    this.selectionThread?.querySelectorAll('.message-bubble.is-selected').forEach((bubble) => {
      bubble.classList.remove('is-selected');
      bubble.setAttribute('aria-selected', 'false');
    });
    this.selectionThread = null;
    this.selectedRefresh = null;
    this.handlers.onSelectionChange?.(null);
    return true;
  }

  dismissForwardPicker(): boolean {
    if (!this.forwardPickerCleanup) return false;
    this.forwardPickerCleanup();
    return true;
  }

  private updateSelection(): void {
    const selected = [...this.selectedMessages.values()];
    if (!selected.length) { this.dismissSelection(); return; }
    this.selectionThread?.querySelectorAll<HTMLDivElement>('.message-bubble[data-message-id]').forEach((bubble) => {
      const active = this.selectedMessages.has(bubble.dataset.messageId!);
      bubble.classList.toggle('is-selected', active);
      bubble.setAttribute('aria-selected', String(active));
    });
    if (selected.length > 1) this.activeMessageActionsCleanup?.();
    this.handlers.onSelectionChange?.({
      count: selected.length,
      canForward: Boolean(this.handlers.onForwardMessage) && selected.every(canForwardMessage),
      canDelete: Boolean(this.handlers.onDeleteMessage) && selected.every((item) =>
        String(item.user_id ?? item.sender_id ?? '') === String(this.session.user.user_id)),
      canCopy: selected.length === 1 && Boolean(displayChatMessage(selected[0]).text)
    });
  }

  private toggleMessageSelection(message: Message, thread: HTMLElement, refresh: () => Promise<void>): void {
    if (message.message_id == null) return;
    const id = String(message.message_id);
    if (this.selectedMessages.has(id)) this.selectedMessages.delete(id);
    else this.selectedMessages.set(id, message);
    this.selectionThread = thread;
    this.selectedRefresh = refresh;
    this.updateSelection();
  }

  async copySelected(): Promise<void> {
    const selected = [...this.selectedMessages.values()];
    if (selected.length !== 1) return;
    const text = displayChatMessage(selected[0]).text;
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('Copy failed');
      }
      this.dismissSelection();
    } catch {
      window.alert('Unable to copy this message.');
    }
  }

  forwardSelected(): void {
    const selected = [...this.selectedMessages.values()];
    if (!selected.length || !selected.every(canForwardMessage) || !this.handlers.onForwardMessage
      || !this.handlers.onLoadConversations || !this.handlers.onLoadContacts) return;
    this.forwardPickerCleanup?.();
    const refresh = this.selectedRefresh;
    const version = this.viewVersion;
    const backdrop = element('div', 'chat-forward-picker');
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Review and forward messages');
    const panel = element('div', 'chat-forward-picker__panel');
    const heading = element('div', 'chat-forward-picker__heading');
    const headingCopy = element('div', 'chat-forward-picker__heading-copy');
    headingCopy.append(elementWithText('small', 'CHATPALEZ'), elementWithText('strong', 'Forward messages'));
    heading.append(headingCopy);
    const closeButton = elementWithText('button', '×') as HTMLButtonElement;
    closeButton.type = 'button';
    closeButton.className = 'chat-forward-picker__close';
    closeButton.setAttribute('aria-label', 'Close forwarding');
    heading.append(closeButton);
    const body = element('div', 'chat-forward-picker__body');
    body.append(elementWithText('h2', 'Send to'));
    const search = document.createElement('form');
    search.className = 'contact-search chat-forward-picker__search';
    const query = document.createElement('input');
    query.type = 'search';
    query.placeholder = 'Search people by name';
    query.setAttribute('aria-label', 'Search people to forward to');
    const searchButton = primaryButton('Search');
    searchButton.type = 'submit';
    search.append(query, searchButton);
    const recent = elementWithText('button', 'Recent chats') as HTMLButtonElement;
    recent.type = 'button';
    recent.className = 'chat-forward-picker__recent';
    const status = paragraph('Select one or more destinations, then review your messages.');
    status.setAttribute('aria-live', 'polite');
    const results = element('div', 'chat-forward-picker__results');
    const more = secondaryButton('Load more');
    more.hidden = true;
    const recipients = element('div', 'chat-forward-picker__recipients');
    recipients.setAttribute('aria-label', 'Selected destinations');
    recipients.hidden = true;
    const review = element('div', 'chat-forward-picker__review');
    review.append(elementWithText('h2', `Review ${selected.length} message${selected.length === 1 ? '' : 's'}`));
    const editors: HTMLTextAreaElement[] = [];
    selected.forEach((item, index) => {
      const card = element('div', 'chat-forward-picker__message');
      const photo = String(item.image || item.photo || '');
      if (photo) {
        const photoUrl = this.handlers.resolveChatPhotoUrl?.(photo);
        if (photoUrl) {
          const image = document.createElement('img');
          image.src = photoUrl;
          image.alt = 'Photo to forward';
          image.loading = 'lazy';
          card.append(image);
        } else card.append(elementWithText('span', 'Photo attachment'));
      }
      const editor = document.createElement('textarea');
      editor.value = displayChatMessage(item).text;
      editor.placeholder = photo ? 'Add or edit a caption (optional)' : 'Edit this message';
      editor.setAttribute('aria-label', `Message ${index + 1} ${photo ? 'caption' : 'text'}`);
      editor.rows = Math.min(5, Math.max(2, editor.value.split('\n').length));
      editors.push(editor);
      card.append(editor);
      review.append(card);
    });
    body.append(search, recent, status, results, more, recipients, review);
    const footer = element('div', 'chat-forward-picker__footer');
    const sendButton = primaryButton('Select a destination');
    sendButton.disabled = true;
    footer.append(sendButton);
    panel.append(heading, body, footer);
    backdrop.append(panel);
    let closed = false;
    let busy = false;
    let failed = false;
    let contacts = false;
    let offset = 0;
    let loadVersion = 0;
    type Destination = { name: string; picture: string; target: { conversationId?: number | string; recipientId?: number | string } };
    const selectedDestinations = new Map<string, Destination>();
    const updateDestinations = (): void => {
      recipients.replaceChildren();
      recipients.hidden = selectedDestinations.size === 0;
      for (const [key, destination] of selectedDestinations) {
        const chip = elementWithText('button', `${destination.name} ×`) as HTMLButtonElement;
        chip.type = 'button';
        chip.className = 'chat-forward-picker__chip';
        chip.setAttribute('aria-label', `Remove ${destination.name}`);
        chip.disabled = busy || failed;
        chip.addEventListener('click', () => {
          selectedDestinations.delete(key);
          updateDestinations();
        });
        recipients.append(chip);
      }
      results.querySelectorAll<HTMLButtonElement>('button[data-destination]').forEach((row) => {
        const selectedRow = selectedDestinations.has(row.dataset.destination!);
        row.classList.toggle('is-selected', selectedRow);
        row.setAttribute('aria-pressed', String(selectedRow));
        row.querySelector('.chat-forward-picker__check')!.textContent = selectedRow ? '✓' : '+';
      });
      sendButton.textContent = selectedDestinations.size
        ? `Send ${selected.length} message${selected.length === 1 ? '' : 's'} to ${selectedDestinations.size} chat${selectedDestinations.size === 1 ? '' : 's'}`
        : 'Select a destination';
      sendButton.disabled = busy || failed || !selectedDestinations.size || editors.some((editor, index) =>
        !editor.value.trim() && !selected[index].image && !selected[index].photo);
    };
    const close = (): void => {
      closed = true;
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
      if (this.forwardPickerCleanup === close) this.forwardPickerCleanup = null;
    };
    const onKeydown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && !busy) close(); };
    const send = async (): Promise<void> => {
      updateDestinations();
      if (busy || failed || sendButton.disabled) return;
      busy = true;
      results.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = true; });
      more.disabled = true;
      query.disabled = true;
      searchButton.disabled = true;
      recent.disabled = true;
      editors.forEach((editor) => { editor.disabled = true; });
      updateDestinations();
      let sent = 0;
      const destinations = [...selectedDestinations.values()];
      const total = destinations.length * selected.length;
      const edited = editors.map((editor) => editor.value.trim());
      let refreshCurrent = false;
      try {
        for (const destination of destinations) {
          let target = destination.target;
          for (const [index, item] of selected.entries()) {
            status.textContent = `Sending ${sent + 1} of ${total} to ${destination.name}…`;
            const result = await this.handlers.onForwardMessage!(
              target, forwardedText(edited[index]), String(item.image || item.photo || '')
            );
            sent += 1;
            if (result.conversation_id === undefined || result.conversation_id === null) {
              throw new Error('The destination chat could not be confirmed.');
            }
            target = { conversationId: result.conversation_id };
            if (String(result.conversation_id) === String(this.activeConversation?.conversation_id)) refreshCurrent = true;
            if (closed) return;
          }
        }
        close();
        this.dismissSelection();
        if (refreshCurrent) await refresh?.();
      } catch (error) {
        failed = true;
        if (!closed) status.textContent = `${sent} of ${total} confirmed. Delivery of the next message is uncertain. Check the destination chats before trying again. ${error instanceof Error ? error.message : ''}`;
        if (refreshCurrent) void refresh?.();
      } finally {
        busy = false;
        if (!closed) updateDestinations();
      }
    };
    const addRow = (key: string, destination: Destination, detail: string): void => {
      const row = element('button', 'chat-forward-picker__row') as HTMLButtonElement;
      row.type = 'button';
      row.dataset.destination = key;
      const avatar = element('span', 'chat-forward-picker__avatar');
      const picture = this.handlers.resolveChatPhotoUrl?.(destination.picture);
      if (picture) {
        const image = document.createElement('img');
        image.src = picture;
        image.alt = '';
        image.loading = 'lazy';
        image.addEventListener('error', () => { avatar.replaceChildren(initials(destination.name)); }, { once: true });
        avatar.append(image);
      } else avatar.textContent = initials(destination.name);
      const copy = element('span', 'chat-forward-picker__row-copy');
      copy.append(elementWithText('strong', destination.name), elementWithText('small', detail));
      const check = element('span', 'chat-forward-picker__check');
      row.append(avatar, copy, check);
      row.addEventListener('click', () => {
        if (selectedDestinations.has(key)) selectedDestinations.delete(key);
        else selectedDestinations.set(key, destination);
        updateDestinations();
      });
      results.append(row);
      updateDestinations();
    };
    const load = async (append = false): Promise<void> => {
      if (busy || failed) return;
      const request = ++loadVersion;
      if (!append) { results.replaceChildren(); offset = 0; }
      status.textContent = 'Loading destinations…';
      try {
        if (contacts) {
          const page = await this.handlers.onLoadContacts!(query.value.trim(), offset);
          if (closed || busy || version !== this.viewVersion || request !== loadVersion) return;
          for (const person of page.items) addRow(`person:${person.user_id}`, {
            name: String(person.user_fullname || person.user_firstname || person.user_name || `User ${person.user_id}`),
            picture: person.user_picture || '', target: { recipientId: person.user_id }
          }, person.user_name ? `@${person.user_name}` : 'ChatPalez member');
          more.hidden = !page.hasMore;
        } else {
          const page = await this.handlers.onLoadConversations!(offset);
          if (closed || busy || version !== this.viewVersion || request !== loadVersion) return;
          for (const chat of page.items) {
            const direct = !chat.multiple_recipients && !chat.node_id && chat.recipients?.length === 1;
            const key = direct ? `person:${chat.recipients![0].user_id}` : `chat:${chat.conversation_id}`;
            addRow(key, {
              name: String(chat.name || chat.name_list || `Chat ${chat.conversation_id}`),
              picture: chat.picture || (direct ? chat.recipients![0].user_picture || '' : ''),
              target: { conversationId: chat.conversation_id }
            }, chat.multiple_recipients || chat.node_id ? 'Group chat' : 'Recent chat');
          }
          more.hidden = !page.hasMore;
        }
        status.textContent = results.childElementCount ? 'Tap to select destinations. You can edit the messages below.' : 'No matching chats found.';
      } catch (error) {
        if (!closed && request === loadVersion) status.textContent = error instanceof Error ? error.message : 'Unable to load chats.';
      }
    };
    closeButton.addEventListener('click', () => { if (!busy) close(); });
    search.addEventListener('submit', (event) => {
      event.preventDefault();
      contacts = true;
      void load();
    });
    recent.addEventListener('click', () => { contacts = false; query.value = ''; void load(); });
    more.addEventListener('click', () => { offset += 1; void load(true); });
    sendButton.addEventListener('click', () => { void send(); });
    editors.forEach((editor) => editor.addEventListener('input', updateDestinations));
    document.addEventListener('keydown', onKeydown);
    document.body.append(backdrop);
    this.forwardPickerCleanup = close;
    void load();
    closeButton.focus();
  }

  async shareSelectedOutside(): Promise<void> {
    const selected = [...this.selectedMessages.values()];
    if (!selected.length) return;
    if (selected.length === 1) {
      const item = selected[0];
      const shared = await this.shareMessage(
        displayChatMessage(item).text,
        this.handlers.resolveChatPhotoUrl?.(item.image || item.photo || '') || undefined
      );
      if (shared) this.dismissSelection();
      return;
    }
    const chunks = selected.map((item) => [
      displayChatMessage(item).text,
      this.handlers.resolveChatPhotoUrl?.(item.image || item.photo || '')
    ].filter(Boolean).join('\n'));
    if (await this.shareMessage(chunks.join('\n\n'))) this.dismissSelection();
  }

  async deleteSelected(): Promise<void> {
    const selected = [...this.selectedMessages.values()];
    if (!selected.length || !this.handlers.onDeleteMessage ||
      selected.some((item) => String(item.user_id ?? item.sender_id ?? '') !== String(this.session.user.user_id))) return;
    if (!window.confirm(`Delete ${selected.length} selected message${selected.length === 1 ? '' : 's'}?`)) return;
    const refresh = this.selectedRefresh;
    let deleted = 0;
    try {
      for (const item of selected) {
        await this.handlers.onDeleteMessage(item.message_id!);
        deleted += 1;
      }
      this.dismissSelection();
      await refresh?.();
    } catch (error) {
      for (const item of selected.slice(0, deleted)) this.selectedMessages.delete(String(item.message_id));
      this.updateSelection();
      window.alert(`${deleted} deleted. ${error instanceof Error ? error.message : 'Unable to delete the remaining messages.'}`);
      await refresh?.();
    }
  }

  private messageBubble(message: Message, refresh: () => Promise<void>): HTMLDivElement {
    const bubble = element('div', 'message-bubble');
    if (message.message_id != null) bubble.dataset.messageId = String(message.message_id);
    const senderId = String(message.user_id ?? message.sender_id ?? '');
    const mine = senderId && senderId === String(this.session.user.user_id ?? '');
    if (mine) bubble.classList.add('is-mine');

    const { text: body, forwarded } = displayChatMessage(message);
    const photoUrl = this.handlers.resolveChatPhotoUrl?.(message.image || message.photo || '');
    if (forwarded) {
      const label = elementWithText('small', 'Forwarded');
      label.className = 'message-forwarded-label';
      bubble.append(label);
    }
    if (photoUrl) {
      const openPhoto = element('button', 'message-photo-open');
      openPhoto.type = 'button';
      openPhoto.setAttribute('aria-label', 'Preview shared photo');
      const image = document.createElement('img');
      image.className = 'message-photo';
      image.src = photoUrl;
      image.alt = 'Shared photo';
      image.loading = 'lazy';
      openPhoto.append(image);
      openPhoto.addEventListener('click', (event) => {
        event.stopPropagation();
        if (bubble.dataset.longPressHandled === '1') {
          delete bubble.dataset.longPressHandled;
          return;
        }
        if (this.selectedMessages.size) {
          this.toggleMessageSelection(message, bubble.parentElement ?? this.content, refresh);
          return;
        }
        this.openImagePreview(photoUrl);
      });
      // Pointer events reach the bubble so a photo has the same long-press menu.
      openPhoto.addEventListener('keydown', (event) => event.stopPropagation());
      image.addEventListener('error', () => {
        openPhoto.replaceChildren(elementWithText('span', 'Photo unavailable'));
        openPhoto.disabled = true;
      }, { once: true });
      bubble.append(openPhoto);
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
    if (message.message_id) {
      this.installMessageActions(bubble, message, refresh);
    }
    return bubble;
  }

  private openImagePreview(photoUrl: string): void {
    this.activeImagePreviewCleanup?.();
    const backdrop = element('div', 'chat-image-preview');
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Chat photo preview');
    const close = secondaryButton('×');
    close.className = 'chat-image-preview__close';
    close.setAttribute('aria-label', 'Close image preview');
    const image = document.createElement('img');
    image.src = photoUrl;
    image.alt = 'Full-size shared photo';
    const viewport = element('div', 'chat-image-preview__viewport');
    viewport.append(image);
    const save = secondaryButton('');
    save.className = 'chat-image-preview__save';
    save.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/></svg>';
    save.setAttribute('aria-label', 'Save photo to Files');
    save.title = 'Save photo to Files';
    save.addEventListener('click', () => {
      save.disabled = true;
      void saveChatPhoto(photoUrl).catch((error: unknown) => {
        if (!/cancel/i.test(error instanceof Error ? error.message : String(error))) {
          window.alert(error instanceof Error ? error.message : 'Unable to save this photo.');
        }
      }).finally(() => { save.disabled = false; });
    });
    backdrop.append(close, viewport, save);
    const dismiss = (): void => {
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
      if (this.activeImagePreviewCleanup === dismiss) this.activeImagePreviewCleanup = null;
    };
    const onKeydown = (event: KeyboardEvent): void => { if (event.key === 'Escape') dismiss(); };
    let scale = 1;
    let startScale = 1;
    let startDistance = 0;
    let offsetX = 0;
    let offsetY = 0;
    let startX = 0;
    let startY = 0;
    const distance = (touches: TouchList): number => Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
    const applyTransform = (): void => {
      image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    };
    viewport.addEventListener('touchstart', (event) => {
      if (event.touches.length === 2) {
        startDistance = distance(event.touches);
        startScale = scale;
      } else if (event.touches.length === 1) {
        startX = event.touches[0].clientX - offsetX;
        startY = event.touches[0].clientY - offsetY;
      }
    }, { passive: true });
    viewport.addEventListener('touchmove', (event) => {
      if (event.touches.length === 2 && startDistance > 0) {
        event.preventDefault();
        scale = Math.min(4, Math.max(.65, startScale * distance(event.touches) / startDistance));
        applyTransform();
      } else if (event.touches.length === 1 && scale > 1) {
        event.preventDefault();
        const limitX = (viewport.clientWidth * (scale - 1)) / 2;
        const limitY = (viewport.clientHeight * (scale - 1)) / 2;
        offsetX = Math.max(-limitX, Math.min(limitX, event.touches[0].clientX - startX));
        offsetY = Math.max(-limitY, Math.min(limitY, event.touches[0].clientY - startY));
        applyTransform();
      }
    }, { passive: false });
    viewport.addEventListener('touchend', (event) => {
      if (event.touches.length === 0) {
        if (scale < .82) { dismiss(); return; }
        if (scale < 1) { scale = 1; offsetX = 0; offsetY = 0; applyTransform(); }
        startDistance = 0;
      } else if (event.touches.length === 1) {
        startX = event.touches[0].clientX - offsetX;
        startY = event.touches[0].clientY - offsetY;
      }
    }, { passive: true });
    close.addEventListener('click', dismiss);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) dismiss(); });
    document.addEventListener('keydown', onKeydown);
    document.body.append(backdrop);
    this.activeImagePreviewCleanup = dismiss;
    close.focus();
  }

  private async shareMessage(body: string, photoUrl?: string): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'ChatPalez message', text: body || undefined, url: photoUrl });
      } else if (navigator.share) {
        await navigator.share({ text: body || undefined, url: photoUrl });
      } else {
        await navigator.clipboard.writeText([body, photoUrl].filter(Boolean).join('\n'));
        window.alert('Message copied. You can paste it into another app.');
      }
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      if (/cancel/i.test(error instanceof Error ? error.message : String(error))) return false;
      window.alert(error instanceof Error ? error.message : 'Unable to share this message.');
      return false;
    }
  }

  private installMessageActions(
    bubble: HTMLDivElement,
    message: Message,
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
      bubble.dataset.longPressHandled = '1';
      this.activeMessageActionsCleanup?.();
      if (!this.selectedMessages.has(String(message.message_id))) {
        this.toggleMessageSelection(message, bubble.parentElement ?? this.content, refresh);
      }
      if (this.selectedMessages.size !== 1) return;
      const menu = element('div', 'message-actions-menu');
      menu.setAttribute('role', 'group');
      menu.setAttribute('aria-label', 'React to selected message');
      const close = (): void => {
        menu.remove();
        document.removeEventListener('keydown', onEscape);
        if (this.activeMessageActionsCleanup === close) this.activeMessageActionsCleanup = null;
      };
      const onEscape = (event: KeyboardEvent): void => { if (event.key === 'Escape') close(); };
      document.addEventListener('keydown', onEscape);
      for (const choice of reactionChoices) {
        if (!this.handlers.onReactToMessage) break;
        const button = secondaryButton(choice.emoji);
        button.classList.add('message-actions-menu__reaction');
        button.setAttribute('aria-label', choice.label);
        button.addEventListener('click', () => {
          close();
          void this.handlers.onReactToMessage!(message.message_id!, choice.value)
            .then(() => refresh())
            .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to react.'));
          this.dismissSelection();
        });
        menu.append(button);
      }
      if (!menu.childElementCount) return;
      document.body.append(menu);
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
    const finishPress = (): void => {
      cancel();
      // A click follows pointerup; keep the flag through it, then clear it.
      if (bubble.dataset.longPressHandled === '1') {
        window.setTimeout(() => { delete bubble.dataset.longPressHandled; }, 400);
      }
    };
    bubble.addEventListener('pointerup', finishPress);
    bubble.addEventListener('pointercancel', finishPress);
    bubble.addEventListener('pointerleave', finishPress);
    bubble.addEventListener('contextmenu', (event) => { event.preventDefault(); show(); });
    bubble.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.message-photo-open')) return;
      if (bubble.dataset.longPressHandled === '1') { delete bubble.dataset.longPressHandled; return; }
      if (this.selectedMessages.size) this.toggleMessageSelection(message, bubble.parentElement ?? this.content, refresh);
    });
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

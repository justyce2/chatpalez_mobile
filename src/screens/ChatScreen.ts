function formatChatLastSeen(value: string): string {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T') + (/[zZ]|[+-]\d\d:\d\d$/.test(value) ? '' : 'Z');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - target.getTime()) / 86400000);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  if (dayDiff === 0) return `today at ${time}`;
  if (dayDiff === 1) return `yesterday at ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date)} at ${time}`;
  if (date.getFullYear() === now.getFullYear()) return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

import type { ChatContact, ChatFeatures, Conversation, Message, MessagesResult } from '../api/chat';
import type { AuthSession } from '../auth/session';
import { CoalescedResync } from '../chat-resync';
import { RealtimeDeliveryUncertainError } from '../chat-realtime';
import { isChatSoundEnabled, playSentChatSound, setChatSoundEnabled, unlockChatAudio } from '../chat-sound';
import { mergeChatHistory } from '../chat-history';
import { clearDirectChatHistory } from '../chat-clear';
import { chatProfilePath } from '../chat-profile-route';
import { chatMessageText } from '../chat-message-text';
import { canForwardMessage, displayChatMessage, forwardedText } from '../chat-forward';
import type { MobileAccount } from '../api/user';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { saveChatPhoto } from '../chat-photo-save';
import { ChatPollingController } from '../chat-polling';
import { listChatOutbox, removeChatOutbox, saveChatOutbox, updateChatOutbox, type ChatOutboxPayload } from '../chat-outbox';
import { loadChatHistory, saveChatHistory } from '../chat-message-cache';

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
  resolveChatMediaUrl?: (source: string) => string | null;
  onPickChatPhoto?: () => Promise<File | null>;
  onPickChatAttachment?: (kind: 'image' | 'video' | 'file') => Promise<File | null>;
  onRecordVoiceNote?: (conversationId: number | string) => Promise<File | null>;
  onDownloadChatMedia?: (source: string, onProgress?: (percent: number) => void) => Promise<string>;
  onChatSoundChange?: (enabled: boolean) => void;
  onLoadChatAccount?: () => Promise<MobileAccount>;
  onSaveChatPrivacy?: (privacy: Record<string, string | boolean>) => Promise<void>;
  onLoadConversations?: (offset: number) => Promise<ChatPageResult<Conversation>>;
  onLoadContacts?: (query: string, offset: number) => Promise<ChatPageResult<ChatContact>>;
  onStartConversation?: (recipientId: number | string, message: string) => Promise<Conversation>;
  onForwardMessage?: (target: { conversationId?: number | string; recipientId?: number | string }, message: string, photo: string) => Promise<Conversation>;
  onLoadChatFeatures?: () => Promise<ChatFeatures>;
  onLoadMessages?: (conversationId: number | string, offset: number, lastMessageId?: number | string) => Promise<MessagesResult>;
  onSendMessage?: (conversationId: number | string, message: string, photo?: File, video?: File, file?: File, voice?: File, onProgress?: (percent: number) => void, clientMessageId?: string, signal?: AbortSignal) => Promise<ChatDeliveryTransport>;
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
  private activeVoiceAudio: HTMLAudioElement | null = null;
  private activeConversation: Conversation | null = null;
  private attachmentCleanup: (() => void) | null = null;
  private readonly selectedMessages = new Map<string, Message>();
  private selectionThread: HTMLElement | null = null;
  private selectedRefresh: (() => Promise<unknown>) | null = null;
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
    const unreadValue = conversation.unread_count ?? conversation.unread_messages ?? conversation.unread;
    const hasUnread = unreadValue !== undefined && unreadValue !== null && unreadValue !== ''
      ? Number(unreadValue) > 0
      : (conversation.seen === false || conversation.seen === 0 || conversation.seen === '0');
    if (hasUnread) row.classList.add('is-unread');

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

  openRecipient(contact: ChatContact): Promise<void> {
    this.handlers.onOpenComposeRoute?.();
    return this.renderNewChat(contact);
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
      const lastSeenRow = element('label', 'chat-settings-row');
      const lastSeen = document.createElement('select');
      const lastSeenOptions = [['public', 'Show last seen'], ['me', 'Hide last seen']];
      for (const [value, label] of lastSeenOptions) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        lastSeen.append(option);
      }
      lastSeen.value = String(privacy.user_privacy_last_seen || 'public');
      lastSeenRow.append(elementWithText('span', 'Show my last seen to others'), lastSeen);
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
          ...privacy, user_chat_enabled: enabled.checked, user_privacy_chat: audience.value, user_privacy_last_seen: lastSeen.value
        }).then(() => { status.textContent = 'Chat privacy saved.'; })
          .catch((error: unknown) => { status.textContent = error instanceof Error ? error.message : 'Unable to save chat privacy.'; })
          .finally(() => { save.disabled = false; });
      });
      serverSettings.replaceChildren(enabledRow, lastSeenRow, audienceRow, save, status);
    } catch (error) {
      if (sheet.isConnected) serverSettings.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load chat privacy.'));
    }
  }

  private async renderNewChat(initialContact?: ChatContact): Promise<void> {
    ++this.viewVersion;
    this.cleanupActiveThread();
    this.activeConversation = null;
    this.handlers.onConversationModeChange?.(false);
    this.content.replaceChildren();
    const header = element('div', 'conversation-header');
    const back = secondaryButton('Back');
    back.classList.add('compact-button');
    back.addEventListener('click', () => this.handlers.onRequestBack?.());
    const recipientName = initialContact
      ? String(initialContact.user_fullname || [initialContact.user_firstname, initialContact.user_lastname].filter(Boolean).join(' ') || initialContact.user_name || 'Chat')
      : '';
    header.append(back, title(initialContact ? `Chat with ${recipientName}` : 'New chat'));
    this.content.append(header);
    if (!initialContact) this.content.append(paragraph('Select one person for a direct chat. Community group chats are managed in Groups.'));
    if (!initialContact && this.handlers.onOpenCommunityGroups) {
      const groups = secondaryButton('Browse community groups');
      groups.addEventListener('click', () => this.handlers.onOpenCommunityGroups?.('/groups'));
      this.content.append(groups);
    }

    if (!this.handlers.onLoadContacts || !this.handlers.onStartConversation) {
      this.content.append(paragraph('Starting new chats is unavailable.'));
      return;
    }

    const selected = new Map<string, ChatContact>();
    if (initialContact) selected.set(String(initialContact.user_id), initialContact);
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
    searchForm.hidden = Boolean(initialContact);

    const results = element('div', 'contact-list');
    this.content.append(results);
    results.hidden = Boolean(initialContact);

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
        const chip = element(initialContact ? 'span' : 'button', 'selected-contact-chip');
        const name = String(contact.user_fullname || contact.user_firstname || contact.user_name || `User ${contact.user_id}`);
        chip.textContent = initialContact ? name : `${name} ×`;
        if (!initialContact) {
          chip.addEventListener('click', () => {
            selected.delete(id);
            refreshSelected();
            void loadContacts();
          });
        }
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

    if (initialContact) refreshSelected();
    else await loadContacts();
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
    const attach = document.createElement('button');
    attach.type = 'button';
    attach.className = 'chat-attachment-button';
    attach.setAttribute('aria-label', 'Add attachment');
    attach.setAttribute('title', 'Add attachment');
    attach.innerHTML = '<span class="chat-attachment-button__icon" aria-hidden="true"></span>';
    const photo = document.createElement('input');
    photo.type = 'file';
    photo.accept = 'image/*';
    photo.hidden = true;
    const attachment = element('div', 'chat-attachment-preview');
    attachment.hidden = true;
    const attachmentMedia = element('div', 'chat-attachment-preview__media');
    const removeAttachment = secondaryButton('Remove');
    removeAttachment.type = 'button';
    removeAttachment.setAttribute('aria-label', 'Remove selected attachment');
    attachment.append(attachmentMedia, removeAttachment);
    const attachmentSheet = element('div', 'chat-attachment-sheet');
    attachmentSheet.hidden = true;
    attachmentSheet.setAttribute('role', 'dialog');
    attachmentSheet.setAttribute('aria-modal', 'true');
    attachmentSheet.setAttribute('aria-label', 'Add attachment');
    const attachmentSheetPanel = element('div', 'chat-attachment-sheet__panel');
    const attachmentSheetHeader = element('div', 'chat-attachment-sheet__header');
    attachmentSheetHeader.append(
      elementWithText('strong', 'Add attachment'),
      (() => {
        const close = elementWithText('button', '×') as HTMLButtonElement;
        close.type = 'button';
        close.className = 'chat-attachment-sheet__close';
        close.setAttribute('aria-label', 'Close attachment options');
        close.addEventListener('click', () => { attachmentSheet.hidden = true; });
        return close;
      })()
    );
    const attachmentSheetOptions = element('div', 'chat-attachment-sheet__options');
    const attachmentIcon = (type: string): string => `<span class="chat-attachment-option__icon chat-attachment-option__icon--${type}" aria-hidden="true"></span>`;
    // Photo availability is runtime state because feature flags load after the attachment sheet is created.
    let photosAvailable = false;
    let attachmentsAvailable = false;
    const addOption = (kind: 'image' | 'camera' | 'video' | 'file' | 'voice', label: string, enabled = true): void => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'chat-attachment-option';
      option.disabled = !enabled;
      option.innerHTML = `${attachmentIcon(kind)}<span>${label}</span>`;
      option.addEventListener('click', () => {
        if ((kind === 'image' || kind === 'camera') && !photosAvailable) return;
        attachmentSheet.hidden = true;
        if (kind === 'voice') {
          if (!this.handlers.onRecordVoiceNote) return;
          option.disabled = true;
          void this.handlers.onRecordVoiceNote(conversationId).then((file) => {
            if (file && version === this.viewVersion) showVoiceAttachment(file);
          }).catch((error: unknown) => {
            if (version === this.viewVersion && error instanceof Error && !/cancel|dismiss/i.test(error.message)) window.alert(error.message);
          }).finally(() => { option.disabled = false; });
          return;
        }
        if (kind === 'camera') {
          if (!this.handlers.onPickChatPhoto) return;
          option.disabled = true;
          void this.handlers.onPickChatPhoto().then((file) => {
            if (file && version === this.viewVersion) showAttachment(file);
          }).catch((error: unknown) => {
            if (version === this.viewVersion && error instanceof Error && !/cancel|dismiss/i.test(error.message)) window.alert(error.message);
          }).finally(() => { option.disabled = !enabled; });
          return;
        }
        if (this.handlers.onPickChatAttachment) {
          option.disabled = true;
          void this.handlers.onPickChatAttachment(kind).then((file) => {
            if (file && version === this.viewVersion) showAttachment(file);
          }).catch((error: unknown) => {
            if (version === this.viewVersion && error instanceof Error && !/cancel|dismiss/i.test(error.message)) window.alert(error.message);
          }).finally(() => { option.disabled = !enabled; });
        } else if (kind === 'image') {
          photo.click();
        }
      });
      attachmentSheetOptions.append(option);
    };
    addOption('image', 'Image', false);
    addOption('camera', 'Camera', false);
    addOption('video', 'Video', false);
    addOption('file', 'File', false);
    addOption('voice', 'Voice note', false);
    attachmentSheetPanel.append(attachmentSheetHeader, attachmentSheetOptions);
    attachmentSheet.append(attachmentSheetPanel);
    document.body.append(attachmentSheet);

    let selectedPhoto: File | null = null;
    let selectedVideo: File | null = null;
    let selectedFile: File | null = null;
    let selectedVoice: File | null = null;
    let previewUrl: string | null = null;
    let videoMaxBytes = 0;
    let fileMaxBytes = 0;
    const clearAttachment = (): void => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      selectedPhoto = null;
      selectedVideo = null;
      selectedFile = null;
      selectedVoice = null;
      photo.value = '';
      attachment.hidden = true;
      attachmentMedia.replaceChildren();
      text.placeholder = 'Write a message…';
      send.setAttribute('aria-label', 'Send message');
    };
    const showVoiceAttachment = (file: File): void => {
      clearAttachment();
      selectedVoice = file;
      previewUrl = URL.createObjectURL(file);
      const voicePreview = elementWithText('div', file.name || 'Voice note');
      voicePreview.className = 'chat-attachment-preview__file chat-attachment-preview__voice';
      attachmentMedia.replaceChildren(voicePreview);
      attachment.hidden = false;
      text.placeholder = 'Add a caption (optional)…';
      send.setAttribute('aria-label', 'Send voice note');
    };
    const showAttachment = (file: File): void => {
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file';
      if (kind === 'image' && !photosAvailable) return;
      if (kind === 'image' && file.size > 8 * 1024 * 1024) { window.alert('This photo is too large. Choose a smaller image.'); return; }
      if (kind === 'video' && videoMaxBytes > 0 && file.size > videoMaxBytes) { window.alert('This video is larger than the site limit. Choose a smaller video.'); return; }
      if (kind === 'file' && fileMaxBytes > 0 && file.size > fileMaxBytes) { window.alert('This file is larger than the site limit. Choose a smaller file.'); return; }
      clearAttachment();
      if (kind === 'image') selectedPhoto = file;
      else if (kind === 'video') selectedVideo = file;
      else selectedFile = file;
      previewUrl = URL.createObjectURL(file);
      if (kind === 'image') {
        const imagePreview = document.createElement('img');
        imagePreview.alt = 'Selected photo';
        imagePreview.src = previewUrl;
        imagePreview.addEventListener('error', () => { imagePreview.hidden = true; }, { once: true });
        attachmentMedia.replaceChildren(imagePreview);
      } else if (kind === 'video') {
        const videoPreview = document.createElement('video');
        videoPreview.className = 'message-video-preview';
        videoPreview.controls = true;
        videoPreview.muted = true;
        videoPreview.playsInline = true;
        videoPreview.preload = 'metadata';
        videoPreview.setAttribute('aria-label', 'Selected video');
        videoPreview.src = previewUrl;
        attachmentMedia.replaceChildren(videoPreview);
      } else {
        const filePreview = elementWithText('div', file.name || 'File attachment');
        filePreview.className = 'chat-attachment-preview__file';
        attachmentMedia.replaceChildren(filePreview);
      }
      attachment.hidden = false;
      text.placeholder = 'Add a caption (optional)…';
      send.setAttribute('aria-label', kind === 'image' ? 'Send message and photo' : kind === 'video' ? 'Send message and video' : 'Send message and file');
    };
    this.attachmentCleanup = (): void => {
      clearAttachment();
      attachmentSheet.remove();
    };
    removeAttachment.addEventListener('click', clearAttachment);
    photo.addEventListener('change', () => { const file = photo.files?.[0]; if (file) showAttachment(file); });
    attach.addEventListener('click', () => {
      attachmentSheet.hidden = false;
    });
    const text = document.createElement('textarea');
    text.rows = 2;
    text.placeholder = 'Write a message…';
    text.setAttribute('aria-label', 'Message or photo caption');
    const savedDraft = this.drafts.get(String(conversationId));
    if (savedDraft) text.value = savedDraft.text;
    const emojiButton = document.createElement('button');
    emojiButton.type = 'button';
    emojiButton.className = 'message-emoji-button';
    emojiButton.textContent = '😊';
    emojiButton.setAttribute('aria-label', 'Choose emoji');
    emojiButton.title = 'Choose emoji';

    const emojiPicker = element('div', 'message-emoji-picker');
    emojiPicker.hidden = true;
    emojiPicker.setAttribute('role', 'dialog');
    emojiPicker.setAttribute('aria-label', 'Emoji picker');
    const composerEmojis = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','🙂','🙃','😉','😌','😍','🥰','😘','😎','🤔','😢','😭','😡','😮','😴','🙏','👏','🙌','👍','👎','❤️','🔥','🎉','💯','✨','💙','💔','🤝','😂','😇','🤗','🤩','😋','😜','🤪','😏','😐','😑','🙄','😬','🤐','🤭','🫶','💪','👋','✌️','👌','💡','🎯','🚀','🌟','🍀','☀️','🌍'];
    for (const emoji of composerEmojis) {
      const option = document.createElement('button');
      option.type = 'button';
      option.textContent = emoji;
      option.setAttribute('aria-label', `Insert ${emoji}`);
      option.addEventListener('click', () => {
        const start = text.selectionStart ?? text.value.length;
        const end = text.selectionEnd ?? start;
        text.value = text.value.slice(0, start) + emoji + text.value.slice(end);
        text.focus();
        const cursor = start + emoji.length;
        text.setSelectionRange(cursor, cursor);
        text.dispatchEvent(new Event('input', { bubbles: true }));
      });
      emojiPicker.append(option);
    }

    const inputWrap = element('div', 'message-composer__input-wrap');
    inputWrap.append(text, emojiButton, emojiPicker);
    emojiButton.addEventListener('click', () => {
      emojiPicker.hidden = !emojiPicker.hidden;
    });

    const send = primaryButton('');
    send.type = 'submit';
    send.classList.add('message-send-button');
    send.setAttribute('aria-label', 'Send message');
    send.innerHTML = '<span class="message-send-button__icon" aria-hidden="true"></span>';
    composer.append(attach, inputWrap, photo, send);
    this.content.append(realtimeStatus, deliveryStatus, attachment, composer);
    if (savedDraft?.photo) showAttachment(savedDraft.photo);
    if (this.handlers.onLoadChatFeatures) {
      void this.handlers.onLoadChatFeatures().then((features) => {
        if (version !== this.viewVersion) return;
        videoMaxBytes = Number(features.videoMaxBytes || 0);
        fileMaxBytes = Number(features.fileMaxBytes || 0);
        const options = Array.from(attachmentSheetOptions.querySelectorAll<HTMLButtonElement>('.chat-attachment-option'));
        const labels = options.map((option) => option.textContent?.trim().toLowerCase());
        const setOption = (label: string, enabled: boolean) => { const index = labels.indexOf(label); if (index >= 0 && options[index]) options[index].disabled = !enabled; };
        setOption('image', features.photos); setOption('camera', features.photos); setOption('video', features.videos); setOption('file', features.files); setOption('voice note', features.voiceNotes);
        photosAvailable = Boolean(features.photos);
        if (!photosAvailable && selectedPhoto) clearAttachment();
        setOption('image', photosAvailable);
        attachmentsAvailable = photosAvailable || features.videos || features.files || features.voiceNotes;
        attach.disabled = !attachmentsAvailable;
        attach.title = attach.disabled ? 'Attachments are disabled by site settings.' : '';
      }).catch(() => {
        if (version !== this.viewVersion) return;
        attach.disabled = true;
        attach.title = 'Unable to determine attachment permissions. Retry by reopening the chat.';
      });
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
    let realtimeConnected = false;
    type PendingDelivery = { bubble: HTMLDivElement; previewUrl: string | null; controller: AbortController; cancelled: boolean };
    const pendingDeliveries = new Map<string, PendingDelivery>();
    let lastMarkedIncomingId: string | null = null;
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
      const seen = !conversation.multiple_recipients && !conversation.node_id && Boolean(seenNameList.trim());
      thread.querySelectorAll<HTMLElement>('.chat-message-receipt').forEach((receipt) => {
        receipt.textContent = seen ? '✓✓' : '✓';
        receipt.setAttribute('aria-label', seen ? `Seen by ${seenNameList}` : 'Sent');
        receipt.title = seen ? 'Seen' : 'Sent';
        receipt.classList.toggle('is-seen', seen);
      });
    };
    const refresh = async (older = false, lastMessageId?: number | string): Promise<boolean> => {
      if (older && (loadingOlder || !hasMoreHistory)) return false;
      if (older) loadingOlder = true;
      try {
        const nextOffset = older ? historyOffset + 1 : 0;
        const result = await this.handlers.onLoadMessages!(conversationId, nextOffset, lastMessageId);
        if (version !== this.viewVersion) return false;
        const messages = result.messages ?? [];
        normalPresence = conversation.multiple_recipients
          ? `${conversation.recipients?.length ?? 0} participants`
          : result.user_is_online ? 'Online'
          : result.user_last_seen ? `Last seen ${formatChatLastSeen(String(result.user_last_seen))}` : normalPresence;
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
        void saveChatHistory(this.session.user.user_id, conversationId, renderedMessages, hasMoreHistory).catch(() => undefined);

        const latestIds = new Set(messages.map((message) => String(message.message_id)));
        const bubbles = renderedMessages.map((message) => {
          const id = String(message.message_id);
          return (!older && latestIds.has(id) ? undefined : existing.get(id)) ?? this.messageBubble(message, refresh);
        });
        // Delivery state belongs to each outgoing message, not just the latest one.
        bubbles.forEach((bubble, index) => {
          const message = renderedMessages[index];
          if (!message || String(message.user_id ?? message.sender_id ?? '') !== String(this.session.user.user_id)) return;
          const receipt = bubble.querySelector<HTMLElement>('.chat-message-receipt') ?? element('small', 'chat-message-receipt');
          receipt.textContent = '✓';
          receipt.setAttribute('aria-label', 'Sent');
          receipt.title = 'Sent';
          if (!receipt.parentElement) bubble.append(receipt);
        });
        thread.replaceChildren(loadOlder, ...bubbles);
        if (this.selectedMessages.size) this.updateSelection();
        if (!renderedMessages.length) thread.append(paragraph('No messages yet.'));
        pendingDeliveries.forEach(({ bubble }) => { if (!bubble.isConnected) thread.append(bubble); });
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

        return true;
      } catch (error) {
        if (!older && !hasLoadedHistory) {
          thread.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load messages.'));
          pendingDeliveries.forEach(({ bubble }) => { if (!bubble.isConnected) thread.append(bubble); });
        } else if (version === this.viewVersion) {
          deliveryStatus.textContent = error instanceof Error ? error.message : 'Unable to refresh messages.';
        }
        return false;
      } finally {
        if (older) {
          loadingOlder = false;
          updateHistoryControl();
        }
      }
    };
    const latestResync = new CoalescedResync(async () => { await refresh(false); });
    const messagePolling = new ChatPollingController({
      intervalMs: 3000,
      isRealtimeConnected: () => realtimeConnected,
      getLastMessageId: () => renderedMessages.length ? renderedMessages[renderedMessages.length - 1]?.message_id : undefined,
      isOnline: () => navigator.onLine !== false && document.visibilityState !== 'hidden',
      poll: async (lastMessageId) => { await refresh(false, lastMessageId); }
    });

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
        normalPresence = online ? 'Online' : lastSeen ? `Last seen ${formatChatLastSeen(String(lastSeen))}` : '';
        presence.textContent = normalPresence;
        updateHeaderPresence(presence.textContent);
      },
      setRealtimeStatus: (connected) => {
        if (version !== this.viewVersion) return;
        realtimeConnected = connected;
        realtimeStatus.textContent = connected ? 'Live chat connected' : 'Standard delivery';
        realtimeStatus.classList.toggle('is-live', connected);
        messagePolling.setRealtimeConnected(connected);
      },
      close: closeThread
    };
    const stopRealtime = this.handlers.onOpenConversation?.(conversation, realtimeHandlers);

    const leaveThread = (): void => {
      if (text.value || selectedPhoto) this.drafts.set(String(conversationId), { text: text.value, photo: selectedPhoto });
      else this.drafts.delete(String(conversationId));
      if (typingTimer) window.clearTimeout(typingTimer);
      setTyping(false);
      messagePolling.stop();
      stopRealtime?.();
    };
    this.activeThreadCleanup = leaveThread;

    loadOlder.addEventListener('click', () => {
      requestedHistory = false;
      updateHistoryControl();
      void refresh(true);
    });
    const createDeliveryBubble = (message: string, files: { photo: File | null; video: File | null; file: File | null; voice: File | null }, previewSource: string | null, localId: string): { bubble: HTMLDivElement; progress: HTMLButtonElement | null } => {
      const bubble = element('div', 'message-bubble is-mine is-pending') as HTMLDivElement;
      bubble.dataset.localMessageId = localId;
      const hasAttachment = Boolean(files.photo || files.video || files.file || files.voice);
      let mediaSurface: HTMLElement | null = null;

      if (hasAttachment) {
        mediaSurface = element('div', 'chat-upload-preview');
        if (files.video && previewSource) {
          const pendingVideo = document.createElement('video');
          pendingVideo.className = 'message-video-preview';
          pendingVideo.src = previewSource;
          pendingVideo.muted = true;
          pendingVideo.playsInline = true;
          pendingVideo.preload = 'metadata';
          pendingVideo.setAttribute('aria-label', 'Video being sent');
          mediaSurface.append(pendingVideo);
        } else if (files.photo && previewSource) {
          const pendingImage = document.createElement('img');
          pendingImage.className = 'message-photo';
          pendingImage.src = previewSource;
          pendingImage.alt = 'Photo being sent';
          mediaSurface.append(pendingImage);
        } else {
          const pendingFile = elementWithText('div', files.voice ? (files.voice.name || 'Voice note') : (files.file?.name || 'File attachment'));
          pendingFile.className = files.voice ? 'message-voice-preview' : 'message-file-preview';
          mediaSurface.append(pendingFile);
        }
        bubble.append(mediaSurface);
      }

      if (message) bubble.append(elementWithText('div', message));

      const progress = hasAttachment ? document.createElement('button') : null;
      if (progress) {
        progress.type = 'button';
        progress.className = 'chat-circular-progress';
        progress.style.setProperty('--chat-progress', '0%');
        progress.setAttribute('aria-label', 'Cancel upload');
        progress.title = 'Cancel upload';
        progress.innerHTML = '<span class="chat-circular-progress__icon" aria-hidden="true"></span>';
        mediaSurface?.append(progress);
      } else {
        bubble.append(elementWithText('small', 'Sending…'));
      }
      return { bubble, progress };
    };

    const finishDelivery = (localId: string, success: boolean, error?: unknown): void => {
      const delivery = pendingDeliveries.get(localId);
      if (!delivery) return;
      if (success) {
        delivery.bubble.remove();
        if (delivery.previewUrl) URL.revokeObjectURL(delivery.previewUrl);
        pendingDeliveries.delete(localId);
        return;
      }

      delivery.bubble.classList.remove('is-pending');
      delivery.bubble.classList.add('is-failed');
      const progress = delivery.bubble.querySelector<HTMLButtonElement>('.chat-circular-progress');
      const hasAttachment = Boolean(delivery.bubble.querySelector('.chat-upload-preview'));

      if (hasAttachment && progress) {
        progress.hidden = false;
        progress.disabled = false;
        progress.classList.add('is-retry');
        progress.setAttribute('aria-label', 'Retry upload');
        progress.title = 'Retry upload';
      } else if (progress) {
        progress.hidden = true;
      }

      const status = delivery.bubble.querySelector<HTMLElement>('.chat-delivery-state') ?? element('small', 'chat-delivery-state');
      status.textContent = delivery.cancelled
        ? 'Upload cancelled. Tap the upload icon to try again.'
        : (error instanceof RealtimeDeliveryUncertainError
          ? 'Delivery uncertain. Check the chat before retrying.'
          : (error instanceof Error ? error.message : 'Unable to send message.'));
      status.setAttribute('role', 'status');
      if (!status.parentElement) delivery.bubble.append(status);

      if (!hasAttachment && !delivery.bubble.querySelector('.chat-delivery-retry')) {
        const retry = secondaryButton('Retry');
        retry.classList.add('chat-delivery-retry');
        retry.type = 'button';
        retry.addEventListener('click', () => {
          retry.disabled = true;
          status.textContent = 'Retrying…';
          delivery.bubble.classList.remove('is-failed');
          delivery.bubble.classList.add('is-pending');
          const payload = (delivery.bubble as HTMLDivElement & { __payload?: ChatOutboxPayload }).__payload;
          if (!payload) {
            retry.disabled = false;
            finishDelivery(localId, false, new Error('This message can no longer be retried.'));
            return;
          }
          void updateChatOutbox(localId, { state: 'sending', error: undefined }).catch(() => undefined);
          delivery.controller = new AbortController();
          delivery.cancelled = false;
          void this.handlers.onSendMessage!(conversationId, payload.message, payload.photo ?? undefined, payload.video ?? undefined, payload.file ?? undefined, payload.voice ?? undefined, (percent) => {
            const progress = delivery.bubble.querySelector<HTMLElement>('.chat-circular-progress');
            if (progress) progress.style.setProperty('--chat-progress', `${Math.max(0, Math.min(100, percent))}%`);
          }, localId, delivery.controller.signal).then(async () => {
            const synced = await refresh();
            if (synced) {
              finishDelivery(localId, true);
            } else {
              const current = pendingDeliveries.get(localId);
              if (current) {
                current.bubble.classList.remove('is-pending');
                const state = current.bubble.querySelector<HTMLElement>('.chat-delivery-state') ?? element('small', 'chat-delivery-state');
                state.textContent = 'Sent. Waiting for chat sync…';
                state.setAttribute('role', 'status');
                if (!state.parentElement) current.bubble.append(state);
                const progress = current.bubble.querySelector<HTMLElement>('.chat-circular-progress');
                if (progress) progress.hidden = true;
              }
            }
            void removeChatOutbox(localId).catch(() => undefined);
            playSentChatSound(this.session.user.user_id);
          }).catch(async (retryError: unknown) => {
            if (retryError instanceof RealtimeDeliveryUncertainError) await latestResync.request().catch(() => undefined);
            void updateChatOutbox(localId, {
              state: retryError instanceof RealtimeDeliveryUncertainError ? 'uncertain' : 'failed',
              error: retryError instanceof Error ? retryError.message : String(retryError ?? 'Unable to send message.')
            }).catch(() => undefined);
            finishDelivery(localId, false, retryError);
            retry.disabled = false;
          });
        });
        delivery.bubble.append(retry);
      }
    };

    const runAttachmentDelivery = (localId: string, payload: ChatOutboxPayload): void => {
      const delivery = pendingDeliveries.get(localId);
      if (!delivery) return;
      delivery.controller = new AbortController();
      delivery.cancelled = false;
      const progress = delivery.bubble.querySelector<HTMLButtonElement>('.chat-circular-progress');
      if (progress) {
        progress.hidden = false;
        progress.disabled = false;
        progress.classList.remove('is-retry');
        progress.setAttribute('aria-label', 'Cancel upload');
        progress.title = 'Cancel upload';
      }
      delivery.bubble.classList.remove('is-failed');
      delivery.bubble.classList.add('is-pending');
      delivery.bubble.querySelector('.chat-delivery-state')?.remove();

      void this.handlers.onSendMessage!(
        conversationId,
        payload.message,
        payload.photo ?? undefined,
        payload.video ?? undefined,
        payload.file ?? undefined,
        payload.voice ?? undefined,
        (percent) => {
          if (progress) progress.style.setProperty('--chat-progress', `${Math.max(0, Math.min(100, percent))}%`);
        },
        localId,
        delivery.controller.signal
      ).then(async () => {
        const synced = await refresh();
        if (synced) {
          finishDelivery(localId, true);
        } else {
          const current = pendingDeliveries.get(localId);
          if (current) {
            current.bubble.classList.remove('is-pending');
            const state = current.bubble.querySelector<HTMLElement>('.chat-delivery-state') ?? element('small', 'chat-delivery-state');
            state.textContent = 'Sent. Waiting for chat sync…';
            state.setAttribute('role', 'status');
            if (!state.parentElement) current.bubble.append(state);
            const progress = current.bubble.querySelector<HTMLElement>('.chat-circular-progress');
            if (progress) progress.hidden = true;
          }
        }
        void removeChatOutbox(localId).catch(() => undefined);
        deliveryStatus.textContent = '';
        playSentChatSound(this.session.user.user_id);
      }).catch(async (error: unknown) => {
        if (error instanceof RealtimeDeliveryUncertainError) await latestResync.request().catch(() => undefined);
        void updateChatOutbox(localId, {
          state: error instanceof RealtimeDeliveryUncertainError ? 'uncertain' : 'failed',
          error: error instanceof Error ? error.message : String(error ?? 'Unable to send message.')
        }).catch(() => undefined);
        finishDelivery(localId, false, error);
      });
    };

    composer.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = text.value.trim();
      const files = { photo: selectedPhoto, video: selectedVideo, file: selectedFile, voice: selectedVoice };
      if ((!message && !files.photo && !files.video && !files.file && !files.voice) || !this.handlers.onSendMessage) return;
      unlockChatAudio(this.session.user.user_id);

      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const deliveryPreviewUrl = previewUrl;
      const { bubble, progress } = createDeliveryBubble(message, files, deliveryPreviewUrl, localId);
      const payload: ChatOutboxPayload = { ...files, message };
      const delivery: PendingDelivery = {
        bubble,
        previewUrl: deliveryPreviewUrl,
        controller: new AbortController(),
        cancelled: false
      };
      (bubble as HTMLDivElement & { __payload?: ChatOutboxPayload }).__payload = payload;
      pendingDeliveries.set(localId, delivery);

      if (progress) {
        progress.addEventListener('click', (clickEvent) => {
          clickEvent.stopPropagation();
          const current = pendingDeliveries.get(localId);
          if (!current) return;
          if (progress.classList.contains('is-retry')) {
            void updateChatOutbox(localId, { state: 'sending', error: undefined }).catch(() => undefined);
            runAttachmentDelivery(localId, payload);
            return;
          }
          current.cancelled = true;
          progress.disabled = true;
          current.controller.abort();
        });
      }

      thread.append(bubble);
      thread.scrollTop = thread.scrollHeight;
      await saveChatOutbox({
        localId,
        conversationId: String(conversationId),
        ...files,
        message,
        state: 'queued',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }).then(() => updateChatOutbox(localId, { state: 'sending', error: undefined })).catch(() => undefined);

      previewUrl = null;
      clearAttachment();
      text.value = '';
      this.drafts.delete(String(conversationId));
      send.disabled = false;
      send.classList.remove('is-sending');
      setTyping(false);

      if (files.photo || files.video || files.file || files.voice) {
        runAttachmentDelivery(localId, payload);
      } else {
        void this.handlers.onSendMessage(conversationId, message, undefined, undefined, undefined, undefined, undefined, localId).then(async () => {
          const synced = await refresh();
          if (synced) {
            finishDelivery(localId, true);
          } else {
            const current = pendingDeliveries.get(localId);
            if (current) {
              current.bubble.classList.remove('is-pending');
              const state = current.bubble.querySelector<HTMLElement>('.chat-delivery-state') ?? element('small', 'chat-delivery-state');
              state.textContent = 'Sent. Waiting for chat sync…';
              state.setAttribute('role', 'status');
              if (!state.parentElement) current.bubble.append(state);
            }
          }
          void removeChatOutbox(localId).catch(() => undefined);
          deliveryStatus.textContent = '';
          playSentChatSound(this.session.user.user_id);
        }).catch(async (error: unknown) => {
          if (error instanceof RealtimeDeliveryUncertainError) await latestResync.request().catch(() => undefined);
          void updateChatOutbox(localId, {
            state: error instanceof RealtimeDeliveryUncertainError ? 'uncertain' : 'failed',
            error: error instanceof Error ? error.message : String(error ?? 'Unable to send message.')
          }).catch(() => undefined);
          finishDelivery(localId, false, error);
        });
      }
    });

    try {
      const cached = await loadChatHistory(this.session.user.user_id, conversationId);
      if (cached?.messages.length && version === this.viewVersion) {
        renderedMessages = cached.messages;
        hasMoreHistory = cached.hasMore;
        hasLoadedHistory = true;
        const cachedBubbles = renderedMessages.map((message) => this.messageBubble(message, refresh));
        thread.replaceChildren(loadOlder, ...cachedBubbles);
        if (this.selectedMessages.size) this.updateSelection();
        thread.scrollTop = thread.scrollHeight;
        previousScrollTop = thread.scrollTop;
        updateHistoryControl();
      }
    } catch {
      // Persistent cache is an optimization; the server remains authoritative.
    }

    try {
      const persisted = await listChatOutbox(String(conversationId));
      for (const record of persisted) {
        if (version !== this.viewVersion) break;
        if (record.state === 'sending') {
          await updateChatOutbox(record.localId, {
            state: 'uncertain',
            error: 'The app closed while this message was being sent. Check the conversation before retrying.'
          }).catch(() => undefined);
          record.state = 'uncertain';
          record.error = 'The app closed while this message was being sent. Check the conversation before retrying.';
        }
        const media = record.photo || record.video || record.file || record.voice;
        const persistedPreviewUrl = media ? URL.createObjectURL(media) : null;
        const delivery = createDeliveryBubble(record.message, {
          photo: record.photo,
          video: record.video,
          file: record.file,
          voice: record.voice
        }, persistedPreviewUrl, record.localId);
        (delivery.bubble as HTMLDivElement & { __payload?: ChatOutboxPayload }).__payload = {
          message: record.message,
          photo: record.photo,
          video: record.video,
          file: record.file,
          voice: record.voice
        };
        pendingDeliveries.set(record.localId, { bubble: delivery.bubble, previewUrl: persistedPreviewUrl, controller: new AbortController(), cancelled: false });
        if (delivery.progress) {
          delivery.progress.addEventListener('click', (clickEvent) => {
            clickEvent.stopPropagation();
            const current = pendingDeliveries.get(record.localId);
            if (!current) return;
            if (delivery.progress!.classList.contains('is-retry')) {
              void updateChatOutbox(record.localId, { state: 'sending', error: undefined }).catch(() => undefined);
              runAttachmentDelivery(record.localId, (current.bubble as HTMLDivElement & { __payload?: ChatOutboxPayload }).__payload!);
              return;
            }
            current.cancelled = true;
            delivery.progress!.disabled = true;
            current.controller.abort();
          });
        }
        thread.append(delivery.bubble);
        const persistedError = record.error
          ? new Error(record.error)
          : new Error(record.state === 'queued' ? 'This message was queued before the app closed.' : 'Unable to send message.');
        finishDelivery(record.localId, false, record.state === 'uncertain'
          ? new RealtimeDeliveryUncertainError(record.error || 'Delivery status is uncertain. Check the conversation before retrying.')
          : persistedError);
      }
      if (persisted.length) thread.scrollTop = thread.scrollHeight;
    } catch {
      // IndexedDB is a durability enhancement; the live chat path remains authoritative.
    }

    await refresh();
    if (version === this.viewVersion) messagePolling.start();
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
    this.activeVoiceAudio?.pause();
    this.activeVoiceAudio = null;
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

  private toggleMessageSelection(message: Message, thread: HTMLElement, refresh: () => Promise<unknown>): void {
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
      editor.rows = Math.min(5, Math.max(2, editor.value.split('\\n').length));
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

  private messageBubble(message: Message, refresh: () => Promise<unknown>): HTMLDivElement {
    const bubble = element('div', 'message-bubble');
    if (message.message_id != null) bubble.dataset.messageId = String(message.message_id);
    const senderId = String(message.user_id ?? message.sender_id ?? '');
    const mine = senderId && senderId === String(this.session.user.user_id ?? '');
    if (mine) bubble.classList.add('is-mine');

    const { text: body, forwarded } = displayChatMessage(message);
    const photoUrl = this.handlers.resolveChatPhotoUrl?.(message.image || message.photo || '');
    const media = (message.attachments ?? {}) as {
      file?: { source?: string; name?: string } | null;
      video_thumbnail?: { source?: string } | null;
    };
    const downloadMedia = this.handlers.onDownloadChatMedia;
    const rawVideoSource = typeof message.video === 'string' ? message.video : '';
    let videoSource = rawVideoSource;
    let videoThumbnailSource = media.video_thumbnail?.source || '';
    if (rawVideoSource) {
      try {
        const parsed = JSON.parse(rawVideoSource) as { source?: unknown; video_thumbnail?: unknown; thumbnail?: unknown };
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.source === 'string' && parsed.source.trim()) videoSource = parsed.source;
          const thumbnail = parsed.video_thumbnail;
          if (thumbnail && typeof thumbnail === 'object' && typeof (thumbnail as { source?: unknown }).source === 'string') {
            videoThumbnailSource = String((thumbnail as { source: string }).source);
          } else if (typeof parsed.thumbnail === 'string' && parsed.thumbnail.trim()) {
            videoThumbnailSource = parsed.thumbnail;
          }
        }
      } catch {
        // Older messages may store the video source as a plain upload path.
      }
    }
    const videoThumbnail = this.handlers.resolveChatPhotoUrl?.(videoThumbnailSource);
    const rawFile = media.file;
    const fileSource = rawFile?.source || (typeof message.file === 'string' ? message.file : '');
    const fileName = rawFile?.name || (typeof message.file_name === 'string' ? message.file_name : '') || body || 'File attachment';
    const voiceSource = typeof message.voice_note === 'string' ? message.voice_note : '';

    const renderDownloadable = (source: string, thumbnail: string, kind: 'video' | 'file' | 'voice'): void => {
      if (!source) return;
      const card = element('div', `chat-media-card chat-media-card--${kind}`);
      const resolvedUrl = this.handlers.resolveChatMediaUrl?.(source);

      if (kind === 'voice') {
        const loadButton = document.createElement('button');
        loadButton.type = 'button';
        loadButton.className = 'chat-voice-load';
        loadButton.setAttribute('aria-label', 'Play voice note');
        loadButton.innerHTML = '<span class="chat-voice-player__play-icon" aria-hidden="true"></span><span>Play voice note</span>';

        const progress = document.createElement('div');
        progress.className = 'chat-circular-progress chat-media-card__progress';
        progress.style.setProperty('--chat-progress', '0%');
        progress.hidden = true;
        progress.innerHTML = '<span class="chat-circular-progress__icon" aria-hidden="true"></span>';

        card.append(loadButton, progress);
        loadButton.addEventListener('click', (event) => {
          event.stopPropagation();

          if (mine && resolvedUrl) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.preload = 'auto';
            audio.src = resolvedUrl;
            audio.setAttribute('aria-label', 'Voice note');
            card.replaceChildren(audio);
            void audio.play().catch(() => undefined);
            return;
          }

          if (!downloadMedia) return;
          loadButton.disabled = true;
          progress.hidden = false;
          void downloadMedia(source, (percent: number) => {
            progress.style.setProperty('--chat-progress', `${Math.max(0, Math.min(100, percent))}%`);
          }).then((url: string) => {
            progress.hidden = true;
            this.mountVoicePlayer(card, url);
            if (this.activeVoiceAudio) void this.activeVoiceAudio.play().catch(() => undefined);
          }).catch((error: unknown) => {
            progress.hidden = true;
            loadButton.disabled = false;
            window.alert(error instanceof Error ? error.message : 'Unable to load this voice note.');
          });
        });
        bubble.append(card);
        return;
      }

      if (kind === 'video') {
        const thumb = thumbnail ? document.createElement('img') : null;
        if (thumb) {
          thumb.className = 'chat-media-card__thumbnail';
          thumb.src = thumbnail;
          thumb.alt = 'Video thumbnail';
          thumb.loading = 'lazy';
          card.append(thumb);
        } else {
          card.append(elementWithText('span', 'Video'));
        }

        const openVideo = document.createElement('button');
        openVideo.type = 'button';
        openVideo.className = 'chat-media-card__download';
        openVideo.setAttribute('aria-label', 'Play video');
        openVideo.innerHTML = '<span class="chat-media-card__play-icon" aria-hidden="true"></span>';
        card.append(openVideo);

        openVideo.addEventListener('click', (event) => {
          event.stopPropagation();
          if (!resolvedUrl) {
            window.alert('This video URL is not available.');
            return;
          }
          const video = document.createElement('video');
          video.controls = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.src = resolvedUrl;
          card.replaceChildren(video);
          void video.play().catch(() => undefined);
        });
        bubble.append(card);
        return;
      }

      const fileLabel = elementWithText('span', fileName);
      fileLabel.className = 'chat-media-card__file-name';
      card.append(fileLabel);

      const openFile = document.createElement('button');
      openFile.type = 'button';
      openFile.className = 'chat-media-card__file-open';
      openFile.setAttribute('aria-label', `Open ${fileName}`);
      openFile.textContent = 'Open';
      card.append(openFile);

      const progress = document.createElement('div');
      progress.className = 'chat-circular-progress chat-media-card__progress';
      progress.style.setProperty('--chat-progress', '0%');
      progress.hidden = true;
      progress.innerHTML = '<span class="chat-circular-progress__icon" aria-hidden="true"></span>';
      card.append(progress);

      const openDownloadedFile = (url: string): void => {
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.pdf')) {
          const frame = document.createElement('iframe');
          frame.className = 'chat-file-preview-frame';
          frame.src = url;
          frame.title = fileName;
          frame.setAttribute('allow', 'fullscreen');
          card.replaceChildren(frame);
          return;
        }

        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = fileName;
        link.className = 'chat-file-open-link';
        card.replaceChildren(link);
        link.click();
      };

      openFile.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!downloadMedia) return;
        openFile.disabled = true;
        progress.hidden = false;
        void downloadMedia(source, (percent: number) => {
          progress.style.setProperty('--chat-progress', `${Math.max(0, Math.min(100, percent))}%`);
        }).then((url: string) => {
          progress.hidden = true;
          openDownloadedFile(url);
        }).catch((error: unknown) => {
          progress.hidden = true;
          openFile.disabled = false;
          window.alert(error instanceof Error ? error.message : 'Unable to open this file.');
        });
      });

      bubble.append(card);
    };
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
      openPhoto.addEventListener('keydown', (event) => event.stopPropagation());
      image.addEventListener('error', () => {
        openPhoto.replaceChildren(elementWithText('span', 'Photo unavailable'));
        openPhoto.disabled = true;
      }, { once: true });
      bubble.append(openPhoto);
    }
    if (videoSource) renderDownloadable(videoSource, videoThumbnail || '', 'video');
    if (fileSource) renderDownloadable(fileSource, '', 'file');
    if (voiceSource) renderDownloadable(voiceSource, '', 'voice');
    if (body && !fileSource) {
      const caption = elementWithText('div', body);
      caption.className = 'chat-message-text';
      bubble.append(caption);
    }
    if (!body && !photoUrl && !videoSource && !fileSource && !voiceSource) {
      bubble.append(elementWithText('div', 'Attachment'));
    }
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

  private mountVoicePlayer(card: HTMLElement, url: string): void {
    this.activeVoiceAudio?.pause();
    this.activeVoiceAudio = null;
    card.replaceChildren();
    card.classList.add('chat-voice-player');

    const audio = new Audio(url);
    audio.preload = 'metadata';
    audio.setAttribute('aria-label', 'Voice note');
    this.activeVoiceAudio = audio;

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'chat-voice-player__play';
    play.setAttribute('aria-label', 'Play voice note');
    play.innerHTML = '<span class="chat-voice-player__play-icon" aria-hidden="true"></span>';

    const body = element('div', 'chat-voice-player__body');
    const times = element('div', 'chat-voice-player__times');
    const current = elementWithText('span', '0:00');
    const duration = elementWithText('span', '0:00');
    times.append(current, duration);

    const seek = document.createElement('input');
    seek.type = 'range';
    seek.min = '0';
    seek.max = '100';
    seek.step = '0.1';
    seek.value = '0';
    seek.className = 'chat-voice-player__seek';
    seek.setAttribute('aria-label', 'Seek voice note');

    const formatTime = (value: number): string => {
      if (!Number.isFinite(value) || value < 0) return '0:00';
      const seconds = Math.floor(value);
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };
    const sync = (): void => {
      current.textContent = formatTime(audio.currentTime);
      duration.textContent = formatTime(audio.duration);
      seek.value = Number.isFinite(audio.duration) && audio.duration > 0 ? String((audio.currentTime / audio.duration) * 100) : '0';
    };
    const toggle = (): void => {
      if (audio.paused) {
        if (this.activeVoiceAudio !== audio) {
          this.activeVoiceAudio?.pause();
          this.activeVoiceAudio = audio;
        }
        void audio.play().catch(() => undefined);
      } else {
        audio.pause();
      }
    };
    play.addEventListener('click', (event) => { event.stopPropagation(); toggle(); });
    seek.addEventListener('input', (event) => {
      event.stopPropagation();
      if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = (Number(seek.value) / 100) * audio.duration;
    });
    audio.addEventListener('loadedmetadata', sync);
    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('play', () => {
      play.setAttribute('aria-label', 'Pause voice note');
      play.innerHTML = '<span class="chat-voice-player__pause-icon" aria-hidden="true"></span>';
    });
    audio.addEventListener('pause', () => {
      play.setAttribute('aria-label', 'Play voice note');
      play.innerHTML = '<span class="chat-voice-player__play-icon" aria-hidden="true"></span>';
    });
    audio.addEventListener('ended', () => { audio.currentTime = 0; sync(); });
    audio.addEventListener('error', () => {
      play.disabled = true;
      current.textContent = 'Unavailable';
    });
    body.append(times, seek);
    card.append(play, body);
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
    refresh: () => Promise<unknown>
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

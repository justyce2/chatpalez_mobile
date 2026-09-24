import type { ChatContact, ChatFeatures, Conversation, Message, MessagesResult } from '../api/chat';
import type { AuthSession } from '../auth/session';
import { CoalescedResync } from '../chat-resync';
import { RealtimeDeliveryUncertainError } from '../chat-realtime';
import { isChatSoundEnabled, playSentChatSound, setChatSoundEnabled, unlockChatAudio } from '../chat-sound';
import type { MobileAccount } from '../api/user';

export type ChatPageResult<T> = { items: T[]; hasMore: boolean };
export type ChatDeliveryTransport = 'realtime' | 'http';

export type ChatScreenHandlers = {
  onConversationModeChange?: (active: boolean) => void;
  onOpenThreadRoute?: (conversation: Conversation) => void;
  onOpenComposeRoute?: () => void;
  onRequestBack?: () => void;
  onThreadPresenceChange?: (conversationId: number | string, presence: string) => void;
  resolveChatPhotoUrl?: (source: string) => string | null;
  onPickChatPhoto?: () => Promise<File | null>;
  onLoadChatAccount?: () => Promise<MobileAccount>;
  onSaveChatPrivacy?: (privacy: Record<string, string | boolean>) => Promise<void>;
  onLoadConversations?: (offset: number) => Promise<ChatPageResult<Conversation>>;
  onLoadContacts?: (query: string, offset: number) => Promise<ChatPageResult<ChatContact>>;
  onStartConversation?: (recipientId: number | string, message: string) => Promise<Conversation>;
  onStartGroupConversation?: (recipientIds: Array<number | string>, message: string) => Promise<Conversation>;
  onCanCustomizeGroupChats?: () => Promise<boolean>;
  onLoadChatFeatures?: () => Promise<ChatFeatures>;
  onUpdateGroupMetadata?: (conversationId: number | string, title: string, picture?: File) => Promise<Conversation>;
  onLoadGroupMetadata?: (conversationId: number | string) => Promise<Conversation>;
  onLoadMessages?: (conversationId: number | string, offset: number) => Promise<MessagesResult>;
  onSendMessage?: (conversationId: number | string, message: string, photo?: File) => Promise<ChatDeliveryTransport>;
  onTyping?: (conversationId: number | string, isTyping: boolean) => Promise<void>;
  onLeaveConversation?: (conversationId: number | string) => Promise<void>;
  onDeleteConversation?: (conversationId: number | string) => Promise<void>;
  onReactToMessage?: (messageId: number | string, reaction: string) => Promise<void>;
  onDeleteMessage?: (messageId: number | string) => Promise<void>;
  onMarkSeen?: (ids: Array<number | string>) => Promise<void>;
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
    const picture = this.handlers.resolveChatPhotoUrl?.(conversation.picture || conversation.recipients?.[0]?.user_picture || '');
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
    if (conversation.multiple_recipients && !conversation.node_id) {
      const group = secondaryButton('Group name & image');
      group.addEventListener('click', () => { close(); this.openGroupSettings(conversation); });
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
    const { sheet, body } = this.createSettingsSheet('Chat settings');
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

  private openGroupSettings(conversation: Conversation): void {
    const { sheet, body, close } = this.createSettingsSheet('Group details');
    if (!conversation.mobile_group_customizable || !this.handlers.onUpdateGroupMetadata) {
      body.append(paragraph('Group details need the mobile group metadata update on the server. Messaging remains available.'));
      this.content.append(sheet);
      return;
    }
    const nameLabel = element('label', 'chat-group-field');
    nameLabel.append(elementWithText('span', 'Group name'));
    const name = document.createElement('input');
    name.type = 'text';
    name.maxLength = 80;
    name.value = String(conversation.name || '');
    nameLabel.append(name);
    const image = secondaryButton('Change group image');
    const preview = document.createElement('img');
    preview.className = 'chat-group-image-preview';
    preview.alt = 'Group image preview';
    preview.hidden = true;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    const selected = element('p', 'chat-settings-status');
    let chosenPhoto: File | undefined;
    const choose = (file: File | null): void => {
      if (!file) return;
      if (!file.type.startsWith('image/')) { selected.textContent = 'Choose an image file.'; return; }
      chosenPhoto = file;
      selected.textContent = `Selected: ${file.name}`;
      const reader = new FileReader();
      reader.onload = () => { preview.src = String(reader.result); preview.hidden = false; };
      reader.readAsDataURL(file);
    };
    fileInput.addEventListener('change', () => choose(fileInput.files?.[0] ?? null));
    image.addEventListener('click', () => {
      if (!this.handlers.onPickChatPhoto) { fileInput.click(); return; }
      void this.handlers.onPickChatPhoto().then(choose).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!/cancel|OS-PLUG-CAMR-0020/i.test(message)) selected.textContent = message;
      });
    });
    const save = primaryButton('Save group details');
    save.addEventListener('click', () => {
      const titleText = name.value.trim();
      if (!titleText) { selected.textContent = 'Enter a group name.'; return; }
      const version = this.viewVersion;
      save.disabled = true;
      selected.textContent = 'Saving…';
      void this.handlers.onUpdateGroupMetadata!(conversation.conversation_id, titleText, chosenPhoto)
        .then((updated) => {
          if (version !== this.viewVersion) return;
          this.activeConversation = updated;
          this.handlers.onOpenThreadRoute?.(updated);
          close();
        })
        .catch((error: unknown) => { selected.textContent = error instanceof Error ? error.message : 'Unable to save group details.'; })
        .finally(() => { save.disabled = false; });
    });
    body.append(nameLabel, image, fileInput, preview, selected, save);
    this.content.append(sheet);
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
    this.content.append(header, paragraph('Select one person for a direct chat, or multiple people for a group chat.'));

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
    const groupDetails = element('div', 'chat-group-creation');
    groupDetails.hidden = true;
    const groupName = document.createElement('input');
    groupName.type = 'text';
    groupName.maxLength = 80;
    groupName.placeholder = 'Group name';
    groupName.setAttribute('aria-label', 'Group name');
    const groupImage = secondaryButton('Choose group image');
    groupImage.type = 'button';
    const groupPreview = document.createElement('img');
    groupPreview.className = 'chat-group-image-preview';
    groupPreview.alt = 'Group image preview';
    groupPreview.hidden = true;
    const groupImageInput = document.createElement('input');
    groupImageInput.type = 'file';
    groupImageInput.accept = 'image/*';
    groupImageInput.hidden = true;
    const groupImageStatus = element('span', 'chat-settings-status');
    let groupPhoto: File | undefined;
    const selectGroupImage = (file: File | null): void => {
      if (!file) return;
      if (!file.type.startsWith('image/')) { groupImageStatus.textContent = 'Choose an image file.'; return; }
      groupPhoto = file;
      groupImageStatus.textContent = `Selected: ${file.name}`;
      const reader = new FileReader();
      reader.onload = () => { groupPreview.src = String(reader.result); groupPreview.hidden = false; };
      reader.readAsDataURL(file);
    };
    groupImageInput.addEventListener('change', () => selectGroupImage(groupImageInput.files?.[0] ?? null));
    groupImage.addEventListener('click', () => {
      if (!this.handlers.onPickChatPhoto) { groupImageInput.click(); return; }
      void this.handlers.onPickChatPhoto().then(selectGroupImage).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!/cancel|OS-PLUG-CAMR-0020/i.test(message)) groupImageStatus.textContent = message;
      });
    });
    groupDetails.append(groupName, groupImage, groupImageInput, groupPreview, groupImageStatus);
    const text = document.createElement('textarea');
    text.rows = 3;
    text.placeholder = 'Write the first message…';
    const send = primaryButton('Start chat');
    send.type = 'submit';
    composer.append(groupDetails, text, send);
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
      groupDetails.hidden = selected.size < 2;
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
      send.textContent = selected.size > 1 ? `Start group (${selected.size})` : 'Start chat';
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
            if (selected.has(id)) selected.delete(id); else selected.set(id, contact);
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

    searchForm.addEventListener('submit', (event) => { event.preventDefault(); offset = 0; void loadContacts(); });
    more.addEventListener('click', () => { if (hasMore) { offset += 1; void loadContacts(true); } });
    composer.addEventListener('submit', (event) => {
      event.preventDefault();
      const message = text.value.trim();
      const ids = [...selected.values()].map((contact) => contact.user_id);
      if (!message || ids.length === 0) return;
      const group = ids.length > 1;
      const groupTitle = groupName.value.trim();
      if (group && !groupTitle) { window.alert('Enter a group name.'); groupName.focus(); return; }
      send.disabled = true;
      send.textContent = 'Starting…';
      void (async () => {
        if (group) {
          if (!this.handlers.onStartGroupConversation || !this.handlers.onUpdateGroupMetadata
            || !await this.handlers.onCanCustomizeGroupChats?.()) {
            throw new Error('Group naming needs the mobile group metadata update on the server. No message was sent.');
          }
          const conversation = await this.handlers.onStartGroupConversation(ids, message);
          try {
            return await this.handlers.onUpdateGroupMetadata(conversation.conversation_id, groupTitle, groupPhoto);
          } catch (error) {
            window.alert(`The group message was sent, but its details could not be saved: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return conversation;
          }
        }
        if (!this.handlers.onStartConversation) throw new Error('Chat is unavailable in this build.');
        return this.handlers.onStartConversation(ids[0], message);
      })()
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
    const seenState = element('p', 'conversation-seen-state');
    seenState.textContent = '';
    const realtimeStatus = element('p', 'conversation-realtime-status');
    realtimeStatus.textContent = 'Connecting to live chat…';
    const deliveryStatus = element('p', 'conversation-delivery-status');
    deliveryStatus.setAttribute('aria-live', 'polite');
    this.content.append(presence, seenState, realtimeStatus, deliveryStatus);

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
    const removeAttachment = secondaryButton('Remove');
    removeAttachment.type = 'button';
    attachment.append(attachmentImage, attachmentName, removeAttachment);
    let selectedPhoto: File | null = null;
    let previewUrl: string | null = null;
    const clearAttachment = (): void => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      selectedPhoto = null;
      photo.value = '';
      attachment.hidden = true;
      attachmentImage.removeAttribute('src');
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
    const send = primaryButton('');
    send.type = 'submit';
    send.classList.add('message-send-button');
    send.setAttribute('aria-label', 'Send message');
    send.innerHTML = '<span class="message-send-button__icon" aria-hidden="true"></span>';
    composer.append(attach, text, photo, send);
    this.content.append(attachment, composer);

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
    let pendingBubble: HTMLDivElement | null = null;
    const refresh = async (older = false): Promise<void> => {
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
        seenState.textContent = result.seen_name_list ? `Seen by ${String(result.seen_name_list)}` : '';
        loadOlder.hidden = !result.has_more;
        if (!older) thread.replaceChildren();
        if (!older && messages.length === 0) thread.append(paragraph('No messages yet.'));

        const bubbles = messages.map((message) => this.messageBubble(message, refresh));
        if (older) {
          const beforeHeight = thread.scrollHeight;
          const beforeTop = thread.scrollTop;
          thread.prepend(...bubbles);
          thread.scrollTop = thread.scrollHeight - beforeHeight + beforeTop;
        } else {
          thread.append(...bubbles);
          if (pendingBubble) thread.append(pendingBubble);
          thread.scrollTop = thread.scrollHeight;
        }
        historyOffset = nextOffset;

        const ids = messages.map((message) => message.message_id)
          .filter((id): id is number | string => id !== undefined && id !== null);
        if (ids.length && this.handlers.onMarkSeen) void this.handlers.onMarkSeen(ids).catch(() => undefined);

      } catch (error) {
        if (!older) {
          thread.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load messages.'));
          if (pendingBubble) thread.append(pendingBubble);
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
        seenState.textContent = seenNameList ? `Seen by ${seenNameList}` : '';
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

    let groupTimer: number | undefined;
    if (conversation.multiple_recipients && !conversation.node_id && this.handlers.onLoadGroupMetadata) {
      let currentName = conversation.name;
      let currentPicture = conversation.picture;
      const syncGroupDetails = async (): Promise<void> => {
        try {
          const updated = await this.handlers.onLoadGroupMetadata!(conversationId);
          if (version !== this.viewVersion) return;
          if (updated.name !== currentName || updated.picture !== currentPicture) {
            currentName = updated.name;
            currentPicture = updated.picture;
            this.activeConversation = updated;
            this.handlers.onOpenThreadRoute?.(updated);
          }
        } catch { /* Message delivery remains usable if metadata is unavailable. */ }
      };
      void syncGroupDetails();
      groupTimer = window.setInterval(() => { if (!document.hidden) void syncGroupDetails(); }, 30000);
    }

    const leaveThread = (): void => {
      if (groupTimer) window.clearInterval(groupTimer);
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
      pendingBubble.append(elementWithText('div', message || 'Photo'));
      pendingBubble.append(elementWithText('small', 'Sending…'));
      thread.append(pendingBubble);
      thread.scrollTop = thread.scrollHeight;
      send.disabled = true;
      attach.disabled = true;
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
    this.attachmentCleanup?.();
    this.attachmentCleanup = null;
    this.activeMessageActionsCleanup?.();
    this.activeMessageActionsCleanup = null;
    const cleanup = this.activeThreadCleanup;
    this.activeThreadCleanup = null;
    cleanup?.();
  }

  private messageBubble(message: Message, refresh: () => Promise<void>): HTMLDivElement {
    const bubble = element('div', 'message-bubble');
    const senderId = String(message.user_id ?? message.sender_id ?? '');
    const mine = senderId && senderId === String(this.session.user.user_id ?? '');
    if (mine) bubble.classList.add('is-mine');

    const body = String(message.message ?? '');
    if (body) bubble.append(elementWithText('div', body));
    const photoUrl = this.handlers.resolveChatPhotoUrl?.(message.image || message.photo || '');
    if (photoUrl) {
      const image = document.createElement('img');
      image.className = 'message-photo';
      image.src = photoUrl;
      image.alt = 'Shared photo';
      image.loading = 'lazy';
      bubble.append(image);
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

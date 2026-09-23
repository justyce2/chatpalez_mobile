import type { ChatContact, Conversation, Message, MessagesResult } from '../api/chat';
import type { AuthSession } from '../auth/session';
import { CoalescedResync } from '../chat-resync';

export type ChatPageResult<T> = { items: T[]; hasMore: boolean };

export type ChatScreenHandlers = {
  onConversationModeChange?: (active: boolean) => void;
  resolveChatPhotoUrl?: (source: string) => string | null;
  onLoadConversations?: (offset: number) => Promise<ChatPageResult<Conversation>>;
  onLoadContacts?: (query: string, offset: number) => Promise<ChatPageResult<ChatContact>>;
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
  onOpenConversation?: (
    conversation: Conversation,
    events: {
      refresh: () => Promise<void>;
      setTyping: (typingNameList: string) => void;
      setPresence: (online: boolean, lastSeen?: string) => void;
      close: (reason?: string) => void;
    }
  ) => (() => void) | void;
};

export class ChatScreen {
  constructor(
    private readonly content: HTMLElement,
    private readonly session: AuthSession,
    private readonly handlers: ChatScreenHandlers
  ) {}

  async render(): Promise<void> {
    this.handlers.onConversationModeChange?.(false);
    this.content.replaceChildren();
    const heading = element('div', 'section-heading-row chat-screen-heading');
    heading.append(title('Chat'));
    if (this.handlers.onLoadContacts && this.handlers.onStartConversation) {
      const compose = secondaryButton('New chat');
      compose.classList.add('compact-button');
      compose.addEventListener('click', () => void this.renderNewChat());
      heading.append(compose);
    }
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
    if (conversation.picture) {
      const img = document.createElement('img');
      img.src = String(conversation.picture);
      img.alt = '';
      img.loading = 'lazy';
      avatar.append(img);
    } else {
      avatar.textContent = conversation.multiple_recipients ? 'G' : 'C';
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
    row.addEventListener('click', () => void this.renderConversation(conversation));
    return row;
  }

  private async renderNewChat(): Promise<void> {
    this.handlers.onConversationModeChange?.(false);
    this.content.replaceChildren();
    const header = element('div', 'conversation-header');
    const back = secondaryButton('Back');
    back.classList.add('compact-button');
    back.addEventListener('click', () => void this.render());
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
          if (contact.user_picture) {
            const avatarImage = document.createElement('img');
            avatarImage.src = String(contact.user_picture);
            avatarImage.alt = '';
            avatarImage.loading = 'lazy';
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
      const operation = ids.length === 1
        ? this.handlers.onStartConversation?.(ids[0], message)
        : this.handlers.onStartGroupConversation?.(ids, message);
      if (!operation) {
        window.alert(ids.length > 1 ? 'Group chat is unavailable in this build.' : 'Chat is unavailable in this build.');
        return;
      }
      send.disabled = true;
      send.textContent = 'Starting…';
      void operation
        .then((conversation) => this.renderConversation(conversation))
        .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to start chat.'))
        .finally(() => { send.disabled = false; refreshSelected(); });
    });

    await loadContacts();
  }

  private async renderConversation(conversation: Conversation): Promise<void> {
    this.handlers.onConversationModeChange?.(true);
    const conversationId = conversation.conversation_id;
    const name = String(conversation.name || conversation.name_list || 'Chat');
    this.content.replaceChildren();

    const header = element('div', 'conversation-header chat-thread-header');
    const back = secondaryButton('Back');
    back.classList.add('compact-button');
    back.addEventListener('click', () => void this.render());
    header.append(back, title(name));

    if (this.handlers.onLeaveConversation || this.handlers.onDeleteConversation) {
      const more = secondaryButton('More');
      more.classList.add('compact-button');
      more.addEventListener('click', () => {
        const choice = window.prompt('Type LEAVE to leave this chat, or DELETE to remove it from your inbox.');
        const action = choice?.trim().toLowerCase();
        const operation = action === 'delete' ? this.handlers.onDeleteConversation
          : action === 'leave' ? this.handlers.onLeaveConversation : undefined;
        if (!operation) return;
        more.disabled = true;
        void operation(conversationId)
          .then(() => this.render())
          .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to update chat.'))
          .finally(() => { more.disabled = false; });
      });
      header.append(more);
    }
    this.content.append(header);

    const presence = element('p', 'conversation-presence');
    presence.textContent = conversation.multiple_recipients
      ? `${conversation.recipients?.length ?? 0} participants`
      : conversation.user_is_online ? 'Online' : '';
    this.content.append(presence);

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
    attach.addEventListener('click', () => photo.click());
    const text = document.createElement('textarea');
    text.rows = 2;
    text.placeholder = 'Write a message…';
    const send = primaryButton('');
    send.type = 'submit';
    send.classList.add('message-send-button');
    send.setAttribute('aria-label', 'Send message');
    send.innerHTML = '<span class="message-send-button__icon" aria-hidden="true"></span>';
    composer.append(attach, text, photo, send);
    this.content.append(composer);

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
    const refresh = async (older = false): Promise<void> => {
      try {
        const nextOffset = older ? historyOffset + 1 : 0;
        const result = await this.handlers.onLoadMessages!(conversationId, nextOffset);
        const messages = result.messages ?? [];
        presence.textContent = result.typing_name_list
          ? `${result.typing_name_list} typing…`
          : result.user_is_online ? 'Online'
          : result.user_last_seen ? `Last seen ${String(result.user_last_seen)}`
          : presence.textContent;
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
          thread.scrollTop = thread.scrollHeight;
        }
        historyOffset = nextOffset;

        const ids = messages.map((message) => message.message_id)
          .filter((id): id is number | string => id !== undefined && id !== null);
        if (ids.length && this.handlers.onMarkSeen) void this.handlers.onMarkSeen(ids).catch(() => undefined);
      } catch (error) {
        if (!older) thread.replaceChildren(paragraph(error instanceof Error ? error.message : 'Unable to load messages.'));
      }
    };
    const latestResync = new CoalescedResync(() => refresh(false));

    let threadClosed = false;
    const closeThread = (reason?: string): void => {
      if (threadClosed) return;
      threadClosed = true;
      if (reason) window.alert(reason);
      void this.render();
    };
    const stopRealtime = this.handlers.onOpenConversation?.(conversation, {
      refresh: () => latestResync.request(),
      setTyping: (typingNameList) => {
        presence.textContent = typingNameList ? `${typingNameList} typing…` : presence.textContent;
      },
      setPresence: (online, lastSeen) => {
        if (conversation.multiple_recipients) return;
        presence.textContent = online ? 'Online' : lastSeen ? `Last seen ${lastSeen}` : '';
      },
      close: closeThread
    });

    const leaveThread = (): void => {
      if (typingTimer) window.clearTimeout(typingTimer);
      setTyping(false);
      stopRealtime?.();
    };
    back.addEventListener('click', leaveThread, { once: true });

    loadOlder.addEventListener('click', () => void refresh(true));
    composer.addEventListener('submit', (event) => {
      event.preventDefault();
      const message = text.value.trim();
      const selectedPhoto = photo.files?.[0];
      if ((!message && !selectedPhoto) || !this.handlers.onSendMessage) return;
      send.disabled = true;
      send.classList.add('is-sending');
      send.setAttribute('aria-label', 'Sending message');
      setTyping(false);
      void this.handlers.onSendMessage(conversationId, message, selectedPhoto)
        .then(async () => {
          text.value = '';
          photo.value = '';
          await refresh();
        })
        .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to send message.'))
        .finally(() => {
          send.disabled = false;
          send.classList.remove('is-sending');
          send.setAttribute('aria-label', 'Send message');
          send.innerHTML = '<span class="message-send-button__icon" aria-hidden="true"></span>';
        });
    });

    await refresh();
  }

  private messageBubble(message: Message, refresh: () => Promise<void>): HTMLDivElement {
    const bubble = element('div', 'message-bubble');
    const senderId = String(message.user_id ?? message.sender_id ?? '');
    const mine = senderId && senderId === String(this.session.user.user_id ?? '');
    if (mine) bubble.classList.add('is-mine');

    const body = String(message.message ?? '');
    if (body) bubble.append(elementWithText('div', body));
    const photoUrl = this.handlers.resolveChatPhotoUrl?.(message.photo ?? '');
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

    if (message.message_id && this.handlers.onReactToMessage) {
      const like = secondaryButton('Like');
      like.classList.add('compact-button');
      like.addEventListener('click', () => {
        like.disabled = true;
        void this.handlers.onReactToMessage!(message.message_id!, 'like')
          .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to react.'))
          .finally(() => { like.disabled = false; });
      });
      bubble.append(like);
    }

    if (message.message_id && mine && this.handlers.onDeleteMessage) {
      const remove = secondaryButton('Delete');
      remove.classList.add('compact-button');
      remove.addEventListener('click', () => {
        if (!window.confirm('Delete this message?')) return;
        remove.disabled = true;
        void this.handlers.onDeleteMessage!(message.message_id!)
          .then(() => refresh())
          .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Unable to delete message.'))
          .finally(() => { remove.disabled = false; });
      });
      bubble.append(remove);
    }
    return bubble;
  }
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
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

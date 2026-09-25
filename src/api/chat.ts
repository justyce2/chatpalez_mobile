import type { ApiPage, ChatPalezApiClient } from './client';

export type ConversationRecipient = {
  user_id: number | string;
  user_name?: string;
  user_firstname?: string;
  user_lastname?: string;
  user_picture?: string;
  user_is_online?: boolean;
  [key: string]: unknown;
};

export type ChatContact = {
  user_id: number | string;
  user_name?: string;
  user_firstname?: string;
  user_lastname?: string;
  user_fullname?: string;
  user_picture?: string;
  user_is_online?: boolean;
  user_last_seen?: string;
  [key: string]: unknown;
};

export type Conversation = {
  conversation_id: number | string;
  name?: string;
  name_list?: string;
  picture?: string;
  link?: string;
  picture_left?: string;
  picture_right?: string;
  multiple_recipients?: boolean;
  seen?: number | string | boolean;
  user_is_online?: boolean;
  user_last_seen?: string;
  recipients?: ConversationRecipient[];
  node_id?: number | string | null;
  node_type?: string | null;
  last_message?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type ChatFeatures = {
  photos: boolean;
  typing: boolean;
  seen: boolean;
  realtime: boolean;
};

export type Message = {
  message_id?: number | string;
  conversation_id?: number | string;
  user_id?: number | string;
  sender_id?: number | string;
  message?: string;
  message_orginal?: string;
  message_orginal_decoded?: string;
  time?: string;
  photo?: string;
  image?: string;
  [key: string]: unknown;
};

export type MessagesResult = {
  messages?: Message[];
  has_more?: boolean;
  typing_name_list?: string;
  seen_name_list?: string;
  user_is_online?: boolean;
  user_last_seen?: string;
};

export class ChatService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async getFeatures(): Promise<ChatFeatures> {
    const settings = await this.api.get<{ system?: Record<string, unknown> }>('app/settings');
    const system = settings.system ?? {};
    const enabled = (value: unknown): boolean => value === true || value === 1 || value === '1';
    return {
      photos: enabled(system.chat_photos_enabled),
      typing: enabled(system.chat_typing_enabled),
      seen: enabled(system.chat_seen_enabled),
      realtime: enabled(system.chat_socket_enabled)
    };
  }

  async getConversations(offset = 0): Promise<Conversation[]> {
    return (await this.getConversationsPage(offset)).data;
  }

  async getConversationsPage(offset = 0): Promise<ApiPage<Conversation[]>> {
    return this.api.getPage<Conversation[]>('chat/conversations', { offset });
  }

  async getConversationForRecipient(userId: number | string): Promise<Conversation | null> {
    const conversation = await this.api.get<Conversation | []>('chat/conversation', {
      conversation_id: 0,
      user_id: userId
    });
    return conversation && !Array.isArray(conversation) && conversation.conversation_id
      ? conversation : null;
  }

  async getContacts(query = '', offset = 0): Promise<ChatContact[]> {
    return (await this.getContactsPage(query, offset)).data;
  }

  async getContactsPage(query = '', offset = 0): Promise<ApiPage<ChatContact[]>> {
    return this.api.getPage<ChatContact[]>('chat/contacts', { query, offset });
  }

  async getMessages(conversationId: number | string, offset = 0, lastMessageId?: number | string): Promise<MessagesResult> {
    return this.api.get<MessagesResult>('chat/messages', {
      conversation_id: conversationId,
      offset,
      last_message_id: lastMessageId
    });
  }

  async sendMessage(conversationId: number | string, message: string, photo = ''): Promise<Conversation> {
    return this.api.post<Conversation>('chat/message', {
      conversation_id: conversationId,
      message,
      photo,
      video: '',
      voice_note: '',
      recipients: ''
    });
  }

  async startConversation(recipientId: number | string, message: string, photo = ''): Promise<Conversation> {
    const recipients = [String(recipientId)];
    return this.api.post<Conversation>('chat/message', {
      conversation_id: null,
      message,
      photo,
      video: '',
      voice_note: '',
      recipients: JSON.stringify(recipients)
    });
  }

  async leaveConversation(conversationId: number | string): Promise<void> {
    await this.api.post<unknown>('chat/actions/leave', { conversation_id: conversationId });
  }

  async deleteConversation(conversationId: number | string): Promise<void> {
    await this.api.delete<unknown>(`chat/conversation/${conversationId}`);
  }

  async reactToMessage(messageId: number | string, reaction: string): Promise<void> {
    await this.api.post<unknown>('chat/reactions/react', { do: 'react', message_id: messageId, reaction });
  }

  async deleteMessage(messageId: number | string): Promise<void> {
    await this.api.delete<unknown>(`chat/message/${messageId}`);
  }

  async setTyping(conversationId: number | string, isTyping: boolean): Promise<void> {
    await this.api.post<unknown>('chat/actions/typing', {
      conversation_id: conversationId,
      is_typing: isTyping ? 1 : 0
    });
  }

  async markSeen(conversationId: number | string): Promise<void> {
    await this.api.post<unknown>('chat/actions/seen', { ids: [conversationId] });
  }
}

import type { ChatPalezApiClient } from './client';

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
  multiple_recipients?: boolean;
  seen?: number | string | boolean;
  user_is_online?: boolean;
  user_last_seen?: string;
  recipients?: ConversationRecipient[];
  last_message?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type Message = {
  message_id?: number | string;
  conversation_id?: number | string;
  user_id?: number | string;
  sender_id?: number | string;
  message?: string;
  time?: string;
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

  async getConversations(offset = 0): Promise<Conversation[]> {
    return this.api.get<Conversation[]>('chat/conversations', { offset });
  }

  async getContacts(query = '', offset = 0): Promise<ChatContact[]> {
    return this.api.get<ChatContact[]>('chat/contacts', { query, offset });
  }

  async getMessages(conversationId: number | string, offset = 0, lastMessageId = 0): Promise<MessagesResult> {
    return this.api.get<MessagesResult>('chat/messages', {
      conversation_id: conversationId,
      offset,
      last_message_id: lastMessageId
    });
  }

  async sendMessage(conversationId: number | string, message: string): Promise<Conversation> {
    return this.api.post<Conversation>('chat/message', {
      conversation_id: conversationId,
      message,
      photo: '',
      video: '',
      voice_note: '',
      recipients: ''
    });
  }

  async startConversation(recipientId: number | string, message: string): Promise<Conversation> {
    return this.api.post<Conversation>('chat/message', {
      conversation_id: null,
      message,
      photo: '',
      video: '',
      voice_note: '',
      recipients: JSON.stringify([recipientId])
    });
  }

  async setTyping(conversationId: number | string, isTyping: boolean): Promise<void> {
    await this.api.post<unknown>('chat/actions/typing', {
      conversation_id: conversationId,
      is_typing: isTyping ? 1 : 0
    });
  }

  async markSeen(ids: Array<number | string>): Promise<void> {
    await this.api.post<unknown>('chat/actions/seen', { ids });
  }
}

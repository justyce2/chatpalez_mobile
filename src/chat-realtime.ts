import { io, type Socket } from 'socket.io-client';
import type { Conversation } from './api/chat';

export type RealtimeMessageEvent = {
  conversation: Conversation;
  last_message?: unknown;
  is_me?: boolean;
};

export type RealtimeTypingEvent = {
  conversation_id: number | string;
  typing_name_list?: string;
};

export type RealtimeSeenEvent = {
  conversation_id: number | string;
  seen_name_list?: string;
};

export type RealtimePresenceEvent = {
  user_id: number | string;
  user_is_online?: boolean;
  user_last_seen?: string;
};

export type ChatRealtimeHandlers = {
  onMessage?: (event: RealtimeMessageEvent) => void;
  onTyping?: (event: RealtimeTypingEvent) => void;
  onSeen?: (event: RealtimeSeenEvent) => void;
  onUserOnline?: (event: RealtimePresenceEvent) => void;
  onUserOffline?: (event: RealtimePresenceEvent) => void;
  onConversationDeleted?: (event: { conversation_id: number | string }) => void;
  onConversationLeft?: (event: { conversation_id: number | string }) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (message: string) => void;
};

type Ack = { ok?: boolean; error?: string };

export class RealtimeDeliveryUncertainError extends Error {
  readonly deliveryUncertain = true;

  constructor(message = 'Realtime delivery could not be confirmed. Refresh the conversation before retrying.') {
    super(message);
    this.name = 'RealtimeDeliveryUncertainError';
  }
}

export class ChatRealtimeService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private handlers = new Set<ChatRealtimeHandlers>();
  private activeConversations = new Set<string>();

  constructor(private readonly socketUrl: URL) {}

  connect(token: string): void {
    if (!token) return;
    if (this.socket && this.token === token) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }
    this.disconnect();
    this.token = token;
    const socket = io(this.socketUrl.toString(), {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      timeout: 10000
    });
    this.socket = socket;

    socket.on('connect', () => {
      for (const conversationId of this.activeConversations) this.joinConversation(conversationId);
      this.emit((handler) => handler.onConnect?.());
    });
    socket.on('disconnect', (reason) => this.emit((handler) => handler.onDisconnect?.(reason)));
    socket.on('connect_error', (error) => this.emit((handler) => handler.onError?.(error.message)));
    socket.on('event_server_error', (data: { message?: string } = {}) => {
      this.emit((handler) => handler.onError?.(String(data.message || 'Realtime chat error')));
    });
    socket.on('event_server_message_received', (data: RealtimeMessageEvent) => {
      this.emit((handler) => handler.onMessage?.(data));
    });
    socket.on('event_server_typing', (data: RealtimeTypingEvent) => {
      this.emit((handler) => handler.onTyping?.(data));
    });
    socket.on('event_server_seen', (data: RealtimeSeenEvent) => {
      this.emit((handler) => handler.onSeen?.(data));
    });
    socket.on('event_server_user_online', (data: RealtimePresenceEvent) => {
      this.emit((handler) => handler.onUserOnline?.(data));
    });
    socket.on('event_server_user_offline', (data: RealtimePresenceEvent) => {
      this.emit((handler) => handler.onUserOffline?.(data));
    });
    socket.on('event_server_delete_conversation', (data: { conversation_id: number | string }) => {
      this.emit((handler) => handler.onConversationDeleted?.(data));
    });
    socket.on('event_server_leave_conversation', (data: { conversation_id: number | string }) => {
      this.emit((handler) => handler.onConversationLeft?.(data));
    });
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.token = null;
  }

  subscribe(handlers: ChatRealtimeHandlers): () => void {
    this.handlers.add(handlers);
    return () => this.handlers.delete(handlers);
  }

  openConversation(conversationId: number | string): void {
    const id = String(conversationId);
    this.activeConversations.add(id);
    this.joinConversation(id);
  }

  closeConversation(conversationId: number | string): void {
    const id = String(conversationId);
    this.activeConversations.delete(id);
    if (this.socket?.connected) this.socket.emit('event_client_close_chatbox', { conversation_id: id });
  }

  setTyping(conversationId: number | string, isTyping: boolean): void {
    if (this.socket?.connected) this.socket.emit('event_client_typing', { conversation_id: conversationId, is_typing: isTyping });
  }

  markSeen(conversationId: number | string): void {
    if (this.socket?.connected) this.socket.emit('event_client_seen', { ids: [conversationId] });
  }

  sendMessage(
    conversationId: number | string,
    message: string
  ): Promise<Conversation> {
    return this.emitJsonAck<Conversation>('event_client_send_message', {
      conversation_id: conversationId,
      message,
      photo: '',
      video: '',
      voice_note: '',
      recipients: ''
    });
  }

  isConnected(): boolean {
    return this.socket?.connected === true;
  }

  pause(): void {
    this.socket?.disconnect();
  }

  resume(): void {
    if (this.socket && this.token && !this.socket.connected) this.socket.connect();
  }

  private joinConversation(conversationId: string): void {
    const socket = this.socket;
    if (!socket?.connected) return;
    socket.emit('event_client_open_thread', { conversation_id: conversationId }, (ack: Ack & { conversation_id?: number | string }) => {
      if (ack?.error) {
        this.emit((handler) => handler.onError?.(String(ack.error)));
      }
    });
  }

  private emitJsonAck<T>(event: string, payload: unknown): Promise<T> {
    const socket = this.socket;
    if (!socket?.connected) return Promise.reject(new Error('Realtime chat is not connected.'));
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new RealtimeDeliveryUncertainError()),
        10000
      );
      socket.emit(event, payload, (raw: string | Ack) => {
        window.clearTimeout(timer);
        try {
          const value = typeof raw === 'string' ? JSON.parse(raw) as T & Ack : raw as T & Ack;
          if (value && typeof value === 'object' && value.error) {
            reject(new Error(String(value.error)));
            return;
          }
          resolve(value as T);
        } catch {
          reject(new Error('Realtime chat returned an invalid response.'));
        }
      });
    });
  }

  private emit(callback: (handler: ChatRealtimeHandlers) => void): void {
    for (const handler of this.handlers) callback(handler);
  }
}

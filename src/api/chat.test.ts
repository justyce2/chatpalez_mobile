import { describe, expect, it, vi } from 'vitest';
import { ChatService } from './chat';
import type { ChatPalezApiClient } from './client';

describe('ChatService', () => {
  it('loads conversations with a zero-based offset', async () => {
    const getPage = vi.fn().mockResolvedValue({ data: [{ conversation_id: 7, name: 'Test' }], hasMore: false });
    const api = { getPage, post: vi.fn() } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    const conversations = await chat.getConversations();

    expect(conversations).toHaveLength(1);
    expect(getPage).toHaveBeenCalledWith('chat/conversations', { offset: 0 });
  });

  it('preserves conversation pagination metadata', async () => {
    const getPage = vi.fn().mockResolvedValue({ data: [{ conversation_id: 7 }], hasMore: true });
    const api = { get: vi.fn(), getPage, post: vi.fn() } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);
    await expect(chat.getConversationsPage(2)).resolves.toEqual({ data: [{ conversation_id: 7 }], hasMore: true });
    expect(getPage).toHaveBeenCalledWith('chat/conversations', { offset: 2 });
  });

  it('loads contact search through the official contacts endpoint', async () => {
    const getPage = vi.fn().mockResolvedValue({ data: [], hasMore: false });
    const api = { getPage, post: vi.fn() } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    await chat.getContacts('Ada', 2);

    expect(getPage).toHaveBeenCalledWith('chat/contacts', { query: 'Ada', offset: 2 });
  });

  it('encodes recipients as JSON when starting a new conversation', async () => {
    const post = vi.fn().mockResolvedValue({ conversation_id: 9 });
    const api = { get: vi.fn(), post } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    await chat.startConversation(42, 'Hello');

    expect(post).toHaveBeenCalledWith('chat/message', {
      conversation_id: null,
      message: 'Hello',
      photo: '',
      video: '',
      voice_note: '',
      recipients: JSON.stringify(['42'])
    });
  });

  it('keeps existing-conversation sends separate from recipient creation', async () => {
    const post = vi.fn().mockResolvedValue({ conversation_id: 9 });
    const api = { get: vi.fn(), post } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    await chat.sendMessage(9, 'Reply');

    expect(post).toHaveBeenCalledWith('chat/message', {
      conversation_id: 9,
      message: 'Reply',
      photo: '',
      video: '',
      voice_note: '',
      recipients: ''
    });
  });

  it('sends an official uploaded photo reference with a message', async () => {
    const post = vi.fn().mockResolvedValue({ conversation_id: 9 });
    const api = { get: vi.fn(), post } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    await chat.sendMessage(9, 'See this', 'photos/2026/09/photo.jpg');

    expect(post).toHaveBeenCalledWith('chat/message', {
      conversation_id: 9,
      message: 'See this',
      photo: 'photos/2026/09/photo.jpg',
      video: '',
      voice_note: '',
      recipients: ''
    });
  });

  it('reads site chat capabilities without presenting them as per-user switches', async () => {
    const get = vi.fn().mockResolvedValue({ system: {
      chat_photos_enabled: '1', chat_typing_enabled: '0', chat_seen_enabled: true, chat_socket_enabled: 1
    } });
    const chat = new ChatService({ get } as unknown as ChatPalezApiClient);
    await expect(chat.getFeatures()).resolves.toEqual({ photos: true, typing: false, seen: true, realtime: true });
    expect(get).toHaveBeenCalledWith('app/settings');
  });

  it('omits the message cursor for ordinary offset history paging', async () => {
    const get = vi.fn().mockResolvedValue({ messages: [] });
    const api = { get, post: vi.fn() } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);
    await chat.getMessages(9, 2);
    expect(get).toHaveBeenCalledWith('chat/messages', { conversation_id: 9, offset: 2, last_message_id: undefined });
  });

  it('supports the official optional message cursor when a caller needs it', async () => {
    const get = vi.fn().mockResolvedValue({ messages: [] });
    const api = { get, post: vi.fn() } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    await chat.getMessages(9, 1, 44);

    expect(get).toHaveBeenCalledWith('chat/messages', { conversation_id: 9, offset: 1, last_message_id: 44 });
  });

  it('uses official conversation and message management routes', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockResolvedValue(undefined);
    const api = { get: vi.fn(), post, delete: del } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    await chat.leaveConversation(9);
    await chat.deleteConversation(9);
    await chat.reactToMessage(12, 'like');
    await chat.deleteMessage(12);

    expect(post).toHaveBeenNthCalledWith(1, 'chat/actions/leave', { conversation_id: 9 });
    expect(post).toHaveBeenNthCalledWith(2, 'chat/reactions/react', { do: 'react', message_id: 12, reaction: 'like' });
    expect(del).toHaveBeenNthCalledWith(1, 'chat/conversation/9');
    expect(del).toHaveBeenNthCalledWith(2, 'chat/message/12');
  });

  it('sends typing and seen state through official chat actions', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const api = { get: vi.fn(), post } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    await chat.setTyping(9, true);
    await chat.markSeen(9);

    expect(post).toHaveBeenNthCalledWith(1, 'chat/actions/typing', {
      conversation_id: 9,
      is_typing: 1
    });
    expect(post).toHaveBeenNthCalledWith(2, 'chat/actions/seen', { ids: [9] });
  });
});

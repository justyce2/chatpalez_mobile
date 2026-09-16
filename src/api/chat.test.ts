import { describe, expect, it, vi } from 'vitest';
import { ChatService } from './chat';
import type { ChatPalezApiClient } from './client';

describe('ChatService', () => {
  it('loads conversations with a zero-based offset', async () => {
    const get = vi.fn().mockResolvedValue([{ conversation_id: 7, name: 'Test' }]);
    const api = { get, post: vi.fn() } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    const conversations = await chat.getConversations();

    expect(conversations).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('chat/conversations', { offset: 0 });
  });

  it('loads contact search through the official contacts endpoint', async () => {
    const get = vi.fn().mockResolvedValue([]);
    const api = { get, post: vi.fn() } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    await chat.getContacts('Ada', 2);

    expect(get).toHaveBeenCalledWith('chat/contacts', { query: 'Ada', offset: 2 });
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
      recipients: JSON.stringify([42])
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

  it('sends typing and seen state through official chat actions', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const api = { get: vi.fn(), post } as unknown as ChatPalezApiClient;
    const chat = new ChatService(api);

    await chat.setTyping(9, true);
    await chat.markSeen([1, 2]);

    expect(post).toHaveBeenNthCalledWith(1, 'chat/actions/typing', {
      conversation_id: 9,
      is_typing: 1
    });
    expect(post).toHaveBeenNthCalledWith(2, 'chat/actions/seen', { ids: [1, 2] });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSockets = vi.hoisted(() => ({ sockets: [] as any[] }));

vi.mock('socket.io-client', () => ({
  io: vi.fn((_url: string, _options: unknown) => {
    const handlers = new Map<string, (...args: any[]) => void>();
    const socket = {
      connected: false,
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        handlers.set(event, handler);
        return socket;
      }),
      emit: vi.fn((_event: string, ..._args: any[]) => undefined),
      connect: vi.fn(() => {
        socket.connected = true;
        handlers.get('connect')?.();
      }),
      disconnect: vi.fn(() => {
        socket.connected = false;
        handlers.get('disconnect')?.('io client disconnect');
      }),
      removeAllListeners: vi.fn(() => handlers.clear())
    };
    mockSockets.sockets.push(socket);
    return socket;
  })
}));

import { io } from 'socket.io-client';
import { ChatRealtimeService, RealtimeDeliveryUncertainError } from './chat-realtime';

describe('RealtimeDeliveryUncertainError', () => {
  it('marks acknowledgement-loss failures as uncertain delivery', () => {
    const error = new RealtimeDeliveryUncertainError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RealtimeDeliveryUncertainError');
    expect(error.deliveryUncertain).toBe(true);
    expect(error.message).toContain('could not be confirmed');
  });
});

describe('ChatRealtimeService connection lifecycle', () => {
  beforeEach(() => {
    mockSockets.sockets.length = 0;
    vi.clearAllMocks();
  });

  it('registers all listeners before the first connect and starts explicitly', () => {
    const service = new ChatRealtimeService(new URL('https://chatpalez.com'));

    service.connect('test-token');

    const socket = mockSockets.sockets[0];
    expect(io).toHaveBeenCalledWith(
      'https://chatpalez.com/',
      expect.objectContaining({
        autoConnect: false,
        tryAllTransports: true,
        path: '/socket.io',
        auth: { token: 'test-token' },
        transports: ['polling', 'websocket']
      })
    );
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(service.isConnected()).toBe(true);
  });

  it('joins an active conversation when it opens before the handshake completes', () => {
    const service = new ChatRealtimeService(new URL('https://chatpalez.com'));
    service.connect('test-token');
    const socket = mockSockets.sockets[0];
    socket.connected = false;

    service.openConversation('42');

    expect(socket.connect).toHaveBeenCalledTimes(2);
    expect(socket.emit).toHaveBeenCalledWith(
      'event_client_open_thread',
      { conversation_id: '42' },
      expect.any(Function)
    );
  });
});

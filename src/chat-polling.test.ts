import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPollingController } from './chat-polling';

describe('ChatPollingController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('polls disconnected chats using the latest message cursor', async () => {
    let realtimeConnected = false;
    let lastMessageId: number | string | undefined = 44;
    const poll = vi.fn().mockResolvedValue(undefined);
    const controller = new ChatPollingController({
      intervalMs: 3000,
      isRealtimeConnected: () => realtimeConnected,
      getLastMessageId: () => lastMessageId,
      poll
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(poll).toHaveBeenCalledTimes(1);
    expect(poll).toHaveBeenLastCalledWith(44);

    lastMessageId = 45;
    await vi.advanceTimersByTimeAsync(3000);
    expect(poll).toHaveBeenLastCalledWith(45);

    controller.stop();
    vi.useRealTimers();
  });

  it('stops polling after realtime reconnects and restarts after disconnect', async () => {
    let realtimeConnected = false;
    const poll = vi.fn().mockResolvedValue(undefined);
    const controller = new ChatPollingController({
      intervalMs: 3000,
      isRealtimeConnected: () => realtimeConnected,
      getLastMessageId: () => 9,
      poll
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(poll).toHaveBeenCalledTimes(1);

    realtimeConnected = true;
    controller.setRealtimeConnected(true);
    await vi.advanceTimersByTimeAsync(6000);
    expect(poll).toHaveBeenCalledTimes(1);

    realtimeConnected = false;
    controller.setRealtimeConnected(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(poll).toHaveBeenCalledTimes(2);

    controller.stop();
    vi.useRealTimers();
  });

  it('does not poll while offline', async () => {
    let realtimeConnected = false;
    let online = false;
    const poll = vi.fn().mockResolvedValue(undefined);
    const controller = new ChatPollingController({
      intervalMs: 3000,
      isRealtimeConnected: () => realtimeConnected,
      getLastMessageId: () => undefined,
      isOnline: () => online,
      poll
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(6000);
    expect(poll).not.toHaveBeenCalled();

    online = true;
    await vi.advanceTimersByTimeAsync(3000);
    expect(poll).toHaveBeenCalledTimes(1);

    controller.stop();
    vi.useRealTimers();
  });
});

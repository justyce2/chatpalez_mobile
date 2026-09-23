import { describe, expect, it, vi } from 'vitest';
import { CoalescedResync } from './chat-resync';

describe('CoalescedResync', () => {
  it('runs one request immediately', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const resync = new CoalescedResync(task);

    await resync.request();

    expect(task).toHaveBeenCalledTimes(1);
    expect(resync.isRunning).toBe(false);
  });

  it('coalesces a burst while a request is in flight into one follow-up run', async () => {
    let release!: () => void;
    const first = new Promise<void>((resolve) => { release = resolve; });
    const task = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(undefined);
    const resync = new CoalescedResync(task);

    const initial = resync.request();
    await Promise.resolve();
    const queuedA = resync.request();
    const queuedB = resync.request();

    expect(task).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([initial, queuedA, queuedB]);

    expect(task).toHaveBeenCalledTimes(2);
    expect(resync.isRunning).toBe(false);
  });

  it('resets running state after a task failure', async () => {
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    const resync = new CoalescedResync(task);

    await expect(resync.request()).rejects.toThrow('network');
    expect(resync.isRunning).toBe(false);
    await expect(resync.request()).resolves.toBeUndefined();
    expect(task).toHaveBeenCalledTimes(2);
  });
});

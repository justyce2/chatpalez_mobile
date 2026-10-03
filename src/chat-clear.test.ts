import { describe, expect, it, vi } from 'vitest';
import { clearDirectChatHistory } from './chat-clear';

describe('clearDirectChatHistory', () => {
  it('enumerates pages before deletion and skips community group nodes', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn()
      .mockResolvedValueOnce({ items: [{ conversation_id: 1 }, { conversation_id: 2, node_id: 7 }, { conversation_id: 4, multiple_recipients: true }], hasMore: true })
      .mockResolvedValueOnce({ items: [{ conversation_id: 3 }, { conversation_id: 1 }], hasMore: false });
    const progress = vi.fn();
    await expect(clearDirectChatHistory(load, remove, progress)).resolves.toEqual({ cleared: 2, total: 2 });
    expect(load.mock.calls.map(([offset]) => offset)).toEqual([0, 1]);
    expect(remove.mock.calls.map(([id]) => id)).toEqual(['1', '3']);
    expect(progress.mock.calls).toEqual([[1, 2], [2, 2]]);
  });

  it('does not delete anything when pagination fails during preflight', async () => {
    const remove = vi.fn();
    const load = vi.fn().mockResolvedValueOnce({ items: [{ conversation_id: 1 }], hasMore: true })
      .mockRejectedValueOnce(new Error('Page failed'));
    await expect(clearDirectChatHistory(load, remove)).rejects.toThrow('Page failed');
    expect(remove).not.toHaveBeenCalled();
  });
});

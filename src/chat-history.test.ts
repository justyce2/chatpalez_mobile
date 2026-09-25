import { describe, expect, it } from 'vitest';
import { mergeChatHistory } from './chat-history';

const message = (id: number, body = String(id)) => ({ message_id: id, message: body });

describe('mergeChatHistory', () => {
  it('retains older pages and appends new messages from a refreshed latest page', () => {
    const current = [1, 2, 3, 4].map((id) => message(id));
    expect(mergeChatHistory(current, [message(4), message(5)], false).map((item) => item.message_id))
      .toEqual([1, 2, 3, 4, 5]);
  });

  it('deduplicates overlapping older pages and keeps the current message state', () => {
    const current = [message(3, 'reacted'), message(4)];
    expect(mergeChatHistory(current, [message(1), message(2), message(3)], true))
      .toEqual([message(1), message(2), message(3, 'reacted'), message(4)]);
  });

  it('replaces or removes messages covered by the latest page', () => {
    const current = [message(1), message(2), message(3), message(4)];
    expect(mergeChatHistory(current, [message(3, 'updated'), message(5)], false))
      .toEqual([message(1), message(2), message(3, 'updated'), message(5)]);
  });
});

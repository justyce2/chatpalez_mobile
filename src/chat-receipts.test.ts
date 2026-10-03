import { describe, expect, it } from 'vitest';
import { latestOutgoingReceipt } from './chat-receipts';

const direct = { conversation_id: 7, multiple_recipients: false };

describe('conversation-level read receipt', () => {
  it('shows seen only on the latest outgoing direct message', () => {
    const messages = [{ message_id: 11, user_id: 2 }, { message_id: 12, user_id: 1 }];
    expect(latestOutgoingReceipt(messages, 1, direct, 'Ada')).toEqual({ messageId: '12', status: 'seen' });
    expect(latestOutgoingReceipt(messages, 1, direct, '')).toEqual({ messageId: '12', status: 'sent' });
  });

  it('does not apply conversation seen state to an older message or a community group', () => {
    expect(latestOutgoingReceipt([{ message_id: 11, user_id: 1 }, { message_id: 12, user_id: 2 }], 1, direct, 'Ada')).toBeNull();
    expect(latestOutgoingReceipt([{ message_id: 11, user_id: 1 }], 1, { ...direct, node_id: 3 }, 'Ada'))
      .toEqual({ messageId: '11', status: 'sent' });
  });
});

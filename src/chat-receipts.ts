import type { Conversation, Message } from './api/chat';

/** The engine exposes conversation-level seen state, not a read state per message. */
export function latestOutgoingReceipt(
  messages: Message[],
  userId: number | string,
  conversation: Conversation,
  seenNameList: string | undefined
): { messageId: string; status: 'sent' | 'seen' } | null {
  const latest = messages[messages.length - 1];
  if (!latest?.message_id || String(latest.user_id ?? latest.sender_id ?? '') !== String(userId)) return null;
  const direct = !conversation.multiple_recipients && !conversation.node_id;
  return {
    messageId: String(latest.message_id),
    status: direct && seenNameList?.trim() ? 'seen' : 'sent'
  };
}

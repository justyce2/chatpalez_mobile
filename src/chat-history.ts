import type { Message } from './api/chat';

/** Keep fetched older pages while replacing the portion covered by a fresh latest page. */
export function mergeChatHistory(current: Message[], page: Message[], older: boolean): Message[] {
  if (!older && page.length === 0) return [];

  const firstLatestId = !older ? Number(page[0].message_id) : 0;
  const retained = older || !Number.isFinite(firstLatestId)
    ? current
    : current.filter((message) => Number(message.message_id) < firstLatestId);
  const byId = new Map<string, Message>();
  for (const message of older ? page : retained) {
    if (message.message_id != null) byId.set(String(message.message_id), message);
  }
  for (const message of older ? current : page) {
    if (message.message_id != null) byId.set(String(message.message_id), message);
  }
  return [...byId.values()].sort((a, b) => Number(a.message_id) - Number(b.message_id));
}

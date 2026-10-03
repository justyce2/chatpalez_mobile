import type { Conversation } from './api/chat';

type ConversationPage = { items: Conversation[]; hasMore: boolean };

/** Enumerate before deleting so offset pagination cannot skip conversations as the list shrinks. */
export async function clearDirectChatHistory(
  load: (offset: number) => Promise<ConversationPage>,
  remove: (id: number | string) => Promise<void>,
  onProgress?: (completed: number, total: number) => void
): Promise<{ cleared: number; total: number }> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset++) {
    const page = await load(offset);
    for (const conversation of page.items) {
      // The official delete route rejects community/group-node conversations.
      if (conversation.node_id == null && !conversation.multiple_recipients) ids.add(String(conversation.conversation_id));
    }
    if (!page.hasMore || page.items.length === 0) break;
  }

  let cleared = 0;
  for (const id of ids) {
    await remove(id);
    onProgress?.(++cleared, ids.size);
  }
  return { cleared, total: ids.size };
}

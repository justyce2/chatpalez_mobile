import type { Message } from './api/chat';

export type ChatMessageCacheRecord = {
  userId: string;
  conversationId: string;
  messages: Message[];
  hasMore: boolean;
  updatedAt: number;
};

const DB_NAME = 'chatpalez-chat-cache';
const DB_VERSION = 1;
const STORE = 'conversations';
const MAX_MESSAGES = 500;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open chat cache.'));
  });
}

function cacheKey(userId: string | number, conversationId: string | number): string {
  return `${String(userId)}:${String(conversationId)}`;
}

export async function loadChatHistory(
  userId: string | number,
  conversationId: string | number
): Promise<ChatMessageCacheRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(cacheKey(userId, conversationId));
    request.onsuccess = () => resolve(request.result ? {
      userId: String(request.result.userId),
      conversationId: String(request.result.conversationId),
      messages: Array.isArray(request.result.messages) ? request.result.messages : [],
      hasMore: Boolean(request.result.hasMore),
      updatedAt: Number(request.result.updatedAt || 0)
    } : null);
    request.onerror = () => reject(request.error ?? new Error('Unable to read chat cache.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error('Chat cache transaction failed.'));
  });
}

export async function saveChatHistory(
  userId: string | number,
  conversationId: string | number,
  messages: Message[],
  hasMore: boolean
): Promise<void> {
  const byId = new Map<string, Message>();
  for (const message of messages) {
    if (message.message_id != null) byId.set(String(message.message_id), message);
  }
  const normalized = [...byId.values()]
    .sort((a, b) => Number(a.message_id) - Number(b.message_id))
    .slice(-MAX_MESSAGES);

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      key: cacheKey(userId, conversationId),
      userId: String(userId),
      conversationId: String(conversationId),
      messages: normalized,
      hasMore: Boolean(hasMore),
      updatedAt: Date.now()
    });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Unable to save chat cache.')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Chat cache transaction aborted.')); };
  });
}

export async function clearChatHistoryCache(userId?: string | number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (userId === undefined) {
      store.clear();
    } else {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value as { userId?: string };
        if (String(value.userId ?? '') === String(userId)) cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to clear chat cache.'));
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Chat cache clear failed.')); };
  });
}

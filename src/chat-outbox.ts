export type ChatOutboxState = 'queued' | 'sending' | 'failed' | 'uncertain';

export type ChatOutboxPayload = {
  message: string;
  photo: File | null;
  video: File | null;
  file: File | null;
  voice: File | null;
};

export type ChatOutboxRecord = ChatOutboxPayload & {
  localId: string;
  conversationId: string;
  state: ChatOutboxState;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = 'chatpalez-chat-outbox';
const DB_VERSION = 1;
const STORE = 'messages';

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
        const store = db.createObjectStore(STORE, { keyPath: 'localId' });
        store.createIndex('conversationId', 'conversationId', { unique: false });
        store.createIndex('state', 'state', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open chat outbox.'));
  });
}

async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Chat outbox operation failed.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error('Chat outbox transaction failed.'));
  });
}

export async function saveChatOutbox(record: ChatOutboxRecord): Promise<void> {
  await transaction('readwrite', (store) => store.put(record));
}

export async function updateChatOutbox(
  localId: string,
  patch: Partial<Pick<ChatOutboxRecord, 'state' | 'error'>>
): Promise<void> {
  const current = await transaction<ChatOutboxRecord | undefined>('readonly', (store) => store.get(localId));
  if (!current) return;
  await saveChatOutbox({ ...current, ...patch, updatedAt: Date.now() });
}

export async function removeChatOutbox(localId: string): Promise<void> {
  await transaction<undefined>('readwrite', (store) => store.delete(localId));
}

export async function listChatOutbox(conversationId?: string): Promise<ChatOutboxRecord[]> {
  if (conversationId === undefined) {
    const result = await transaction<ChatOutboxRecord[]>('readonly', (store) => store.getAll());
    return result ?? [];
  }
  const result = await transaction<ChatOutboxRecord[]>('readonly', (store) => store.index('conversationId').getAll(conversationId));
  return result ?? [];
}

export async function clearChatOutbox(): Promise<void> {
  await transaction<undefined>('readwrite', (store) => store.clear());
}

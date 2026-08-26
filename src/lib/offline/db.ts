// Minimal native IndexedDB wrapper for the mobile-tasks offline queue (P20).
// No dependency (idb/dexie) needed for one small object store.

const DB_NAME = "monjez-offline";
const DB_VERSION = 1;
export const MUTATIONS_STORE = "pending_mutations";

let dbPromise: Promise<IDBDatabase> | null = null;

function isSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

export function getDb(): Promise<IDBDatabase> {
  if (!isSupported()) return Promise.reject(new Error("IndexedDB غير مدعوم في هذا المتصفح"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
          db.createObjectStore(MUTATIONS_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readwrite").objectStore(store).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function idbDelete(store: string, key: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readwrite").objectStore(store).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

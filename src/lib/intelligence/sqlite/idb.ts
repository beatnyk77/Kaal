const IDB_NAME = 'kaal_intelligence';
const IDB_VERSION = 1;
const STORE = 'sqlite';
const DB_KEY = 'main_v1';

export async function loadDbBytes(): Promise<Uint8Array | null> {
  if (typeof indexedDB === 'undefined') return null;

  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => resolve(null);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const tx = req.result.transaction(STORE, 'readonly');
      const get = tx.objectStore(STORE).get(DB_KEY);
      get.onsuccess = () => {
        const val = get.result as Uint8Array | undefined;
        resolve(val ?? null);
      };
      get.onerror = () => resolve(null);
    };
  });
}

export async function saveDbBytes(bytes: Uint8Array): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const tx = req.result.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(bytes, DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}
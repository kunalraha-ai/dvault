"use client";

/**
 * Client-side encrypted local cache (IndexedDB) — the "local" half of D-Vault's
 * hybrid storage. Stores the SAME ciphertext the server holds (plus profile
 * metadata) so the vault UI stays fast and works when the cloud is briefly
 * unreachable. Everything value-like remains ciphertext on this device too.
 */

const DB_NAME = "dvault-cache";
const STORE = "kv";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function cachePut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  const result = await new Promise<T | null>((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
  db.close();
  return result;
}

export async function cacheClearAll(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

/** A stable per-browser device key for sync metadata (not a secret). */
export function deviceKey(): string {
  let k = localStorage.getItem("dvault_device_key");
  if (!k) {
    k = crypto.randomUUID();
    localStorage.setItem("dvault_device_key", k);
  }
  return k;
}

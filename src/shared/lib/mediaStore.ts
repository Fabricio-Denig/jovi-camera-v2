import type { CapturedMedia } from "../../types/camera";

/**
 * Minimal IndexedDB wrapper for local media persistence.
 * No external dependency on purpose — this is the only place in the app that
 * touches IndexedDB directly, so a tiny hand-rolled wrapper is cheaper to read
 * and audit than pulling in a library for ~40 lines of logic.
 */

const DB_NAME = "jovi-camera-v2";
const DB_VERSION = 1;
const STORE_NAME = "captures";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCapture(media: CapturedMedia): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(media);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAllCaptures(): Promise<CapturedMedia[]> {
  const db = await openDb();
  const items = await new Promise<CapturedMedia[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as CapturedMedia[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLatestCapture(): Promise<CapturedMedia | undefined> {
  const items = await getAllCaptures();
  return items[0];
}

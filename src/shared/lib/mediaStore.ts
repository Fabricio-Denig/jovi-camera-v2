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

async function readAll(): Promise<CapturedMedia[]> {
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

/**
 * Everything the student still has. Thrown-away captures stay in the database
 * and are filtered here, in the one place every screen reads from — so nothing
 * downstream has to remember that the trash exists.
 */
export async function getAllCaptures(): Promise<CapturedMedia[]> {
  return (await readAll()).filter((item) => !item.deletedAt);
}

/** What is in the trash, most recently thrown away first. */
export async function getTrashedCaptures(): Promise<CapturedMedia[]> {
  return (await readAll())
    .filter((item) => item.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export async function getLatestCapture(): Promise<CapturedMedia | undefined> {
  const items = await getAllCaptures();
  return items[0];
}

/** Applies a change to captures the test picks out, in one pass over the store. */
async function updateWhere(
  match: (media: CapturedMedia) => boolean,
  change: (media: CapturedMedia) => CapturedMedia,
): Promise<void> {
  const items = await readAll();
  for (const media of items) {
    if (!match(media)) continue;
    await saveCapture(change(media));
  }
}

export async function trashCaptures(
  match: (media: CapturedMedia) => boolean,
): Promise<void> {
  const deletedAt = Date.now();
  await updateWhere(match, (media) => ({ ...media, deletedAt }));
}

export async function restoreCaptures(
  match: (media: CapturedMedia) => boolean,
): Promise<void> {
  await updateWhere(match, ({ deletedAt: _discarded, ...media }) => media);
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  await updateWhere((media) => media.id === id, (media) => ({ ...media, favorite }));
}

/** The only irreversible operation in the app, and it is always confirmed first. */
export async function deleteCapturesForever(
  match: (media: CapturedMedia) => boolean,
): Promise<void> {
  const items = await readAll();
  const doomed = items.filter(match).map((media) => media.id);
  if (doomed.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const id of doomed) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

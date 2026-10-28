/**
 * مخزن الأصوات المخصصة للمعلم (IndexedDB).
 * يسمح برفع ملفات صوتية تحل محل المؤثرات الافتراضية والتعليق الصوتي الآلي.
 */

const DB_NAME = "lesson2_sounds";
const STORE = "files";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putSound(key: string, blob: Blob) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  cache.delete(key);
  notify();
}

export async function deleteSound(key: string) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const url = cache.get(key);
  if (url) URL.revokeObjectURL(url);
  cache.delete(key);
  notify();
}

export async function listSoundKeys(): Promise<string[]> {
  try {
    const db = await openDB();
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function getBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/* ===== ذاكرة مؤقتة للروابط + قائمة المفاتيح المتاحة ===== */
const cache = new Map<string, string>();
let availableKeys = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  void refreshKeys();
  listeners.forEach((l) => l());
}

export function onSoundsChanged(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function refreshKeys() {
  availableKeys = new Set(await listSoundKeys());
}

export function hasCustom(key: string) {
  return availableKeys.has(key);
}

export async function getSoundURL(key: string): Promise<string | null> {
  if (cache.has(key)) return cache.get(key)!;
  const blob = await getBlob(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  cache.set(key, url);
  return url;
}

/** تشغيل ملف صوتي مخصص؛ يعيد false إذا لم يوجد */
export async function playCustom(key: string, onEnd?: () => void): Promise<HTMLAudioElement | null> {
  const url = await getSoundURL(key);
  if (!url) {
    onEnd?.();
    return null;
  }
  const audio = new Audio(url);
  audio.onended = () => onEnd?.();
  audio.onerror = () => onEnd?.();
  void audio.play().catch(() => onEnd?.());
  return audio;
}

void refreshKeys();

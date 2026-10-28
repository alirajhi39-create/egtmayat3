/**
 * مخزن الأصوات المخصصة للمعلم.
 * - يُحفظ الملف محلياً (IndexedDB) لتشغيل فوري وسريع.
 * - ويُرفع إلى Neon عبر /api/sounds ليُتاح على جميع الأجهزة.
 * - عند التشغيل: نحاول المحلي، فإن لم يوجد نجلبه من السحابة ونخزّنه محلياً.
 */

const DB_NAME = "lesson2_sounds";
const STORE = "files";
export const MAX_SOUND_BYTES = 4 * 1024 * 1024;

/* ================= IndexedDB ================= */
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

async function dbPut(key: string, blob: Blob) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const old = cache.get(key);
  if (old) URL.revokeObjectURL(old);
  cache.delete(key);
}

async function dbDelete(key: string) {
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
}

async function dbGet(key: string): Promise<Blob | null> {
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

export async function listSoundKeys(): Promise<string[]> {
  try {
    const db = await openDB();
    return await new Promise<string[]>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/* ================= الحالة ================= */
const cache = new Map<string, string>();
let remoteKeys = new Set<string>();
let localKeys = new Set<string>();
let availableKeys = new Set<string>();
let cloudOnline = false;
let lastError = "";
let maxBytes = MAX_SOUND_BYTES;
const remoteVersions = new Map<string, string>();
const listeners = new Set<() => void>();

/* نسخ الملفات المخزّنة محلياً لمقارنتها بالسحابة */
const LS_VERSIONS = "lesson2_sound_versions";
function readVersions(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_VERSIONS) || "{}");
  } catch {
    return {};
  }
}
function saveVersion(key: string, version: string) {
  try {
    const all = readVersions();
    all[key] = version;
    localStorage.setItem(LS_VERSIONS, JSON.stringify(all));
  } catch {}
}
function getSavedVersion(key: string) {
  return readVersions()[key];
}

function notify() {
  listeners.forEach((l) => l());
}

export function onSoundsChanged(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export const isCloudOnline = () => cloudOnline;
export const isCloud = (key: string) => remoteKeys.has(key);
export const hasCustom = (key: string) => availableKeys.has(key);
export const getLastError = () => lastError;
export const getMaxBytes = () => maxBytes;
export const listRemoteKeys = () => Array.from(remoteKeys);

/* ================= جلب القائمة من السحابة ================= */
export async function refreshKeys(): Promise<{ cloud: boolean; count: number }> {
  localKeys = new Set(await listSoundKeys());
  try {
    const res = await fetch("/api/sounds", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const list = data.sounds || [];
    remoteKeys = new Set<string>(list.map((s: any) => String(s.key)));
    // عند استبدال ملف على جهاز آخر: احذف النسخة المحلية القديمة ليُجلب الجديد
    for (const item of list) {
      const k = String(item.key);
      const v = String(item.updatedAt || item.updated_at || "");
      remoteVersions.set(k, v);
      if (v && v !== getSavedVersion(k)) {
        if (localKeys.has(k)) {
          await dbDelete(k);
          localKeys.delete(k);
        }
        saveVersion(k, v);
      }
    }
    if (typeof data.maxBytes === "number" && data.maxBytes > 0) maxBytes = data.maxBytes;
    cloudOnline = true;
  } catch {
    cloudOnline = false;
  }
  availableKeys = new Set([...localKeys, ...remoteKeys]);
  notify();
  return { cloud: cloudOnline, count: remoteKeys.size };
}

/* ================= الرفع / الحذف ================= */
export async function putSound(key: string, blob: Blob): Promise<{ synced: boolean; error?: string }> {
  if (blob.size > maxBytes) {
    const msg = `حجم الملف ${(blob.size / 1048576).toFixed(1)} ميجابايت أكبر من المسموح (${Math.round(
      maxBytes / 1048576
    )} ميجابايت).`;
    lastError = msg;
    throw new Error(msg);
  }

  // ١) حفظ محلي فوري
  await dbPut(key, blob);
  localKeys.add(key);
  availableKeys.add(key);

  // ٢) رفع للسحابة
  lastError = "";
  let synced = false;
  try {
    const res = await fetch(`/api/sounds?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "Content-Type": blob.type || "audio/mpeg",
        "X-File-Name": encodeURIComponent(`${key}.${(blob.type.split("/")[1] || "mp3").replace("mpeg", "mp3")}`),
      },
      body: blob,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `فشل الرفع (${res.status})`);
    synced = true;
    remoteKeys.add(key);
    if (data?.updatedAt) {
      remoteVersions.set(key, String(data.updatedAt));
      saveVersion(key, String(data.updatedAt));
    }
    cloudOnline = true;
  } catch (e: any) {
    lastError = e?.message || "تعذّر الرفع إلى السحابة";
  }

  notify();
  return { synced, error: synced ? undefined : lastError };
}

export async function deleteSound(key: string) {
  await dbDelete(key);
  localKeys.delete(key);
  availableKeys.delete(key);
  try {
    const res = await fetch(`/api/sounds?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    if (res.ok) remoteKeys.delete(key);
  } catch {}
  remoteVersions.delete(key);
  try {
    const all = readVersions();
    delete all[key];
    localStorage.setItem(LS_VERSIONS, JSON.stringify(all));
  } catch {}
  notify();
}

/** رفع كل الملفات الموجودة على هذا الجهاز فقط إلى السحابة */
export async function syncLocalToCloud(): Promise<{ uploaded: number; failed: number }> {
  const pending = Array.from(localKeys).filter((k) => !remoteKeys.has(k));
  let uploaded = 0;
  let failed = 0;
  for (const key of pending) {
    const blob = await dbGet(key);
    if (!blob) {
      failed++;
      continue;
    }
    try {
      const res = await fetch(`/api/sounds?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "audio/mpeg",
          "X-File-Name": encodeURIComponent(`${key}.${(blob.type.split("/")[1] || "mp3").replace("mpeg", "mp3")}`),
        },
        body: blob,
      });
      if (!res.ok) throw new Error();
      remoteKeys.add(key);
      uploaded++;
    } catch {
      failed++;
    }
  }
  cloudOnline = uploaded > 0 || cloudOnline;
  notify();
  return { uploaded, failed };
}

/* ================= تشغيل الصوت ================= */
function cacheRemote(key: string, blob: Blob) {
  void dbPut(key, blob);
  localKeys.add(key);
  availableKeys.add(key);
}

export async function getSoundURL(key: string): Promise<string | null> {
  if (cache.has(key)) return cache.get(key)!;

  const local = await dbGet(key);
  if (local) {
    const url = URL.createObjectURL(local);
    cache.set(key, url);
    return url;
  }

  try {
    const version = remoteVersions.get(key) || getSavedVersion(key) || "1";
    const res = await fetch(`/api/sounds?key=${encodeURIComponent(key)}&v=${encodeURIComponent(version)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    // في التشغيل المحلي بدون API قد يرجع index.html — لا نعتبره صوتاً
    if (!type.startsWith("audio/") && !type.includes("octet-stream")) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    cacheRemote(key, blob);
    const url = URL.createObjectURL(blob);
    cache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

/** تشغيل ملف صوتي مخصص؛ يعيد null إذا لم يوجد */
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

// تحميل القائمة عند بدء التطبيق ليعرف المتصفح الأصوات المتاحة سحابياً
void refreshKeys();

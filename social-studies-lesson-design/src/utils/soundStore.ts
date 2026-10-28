/**
 * مخزن الأصوات المخصصة للمعلم.
 * - يُحفظ الملف محلياً (IndexedDB) لتشغيل فوري وسريع.
 * - ويُرفع إلى Neon عبر /api/sounds ليُتاح على جميع الأجهزة.
 * - الملفات السحابية تُشغّل مباشرة من رابط النسخة، وتُحمّل مسبقاً للشريحة القادمة.
 */

const DB_NAME = "lesson2_sounds";
const STORE = "files";
export const MAX_SOUND_BYTES = 4 * 1024 * 1024;

/* ================= IndexedDB ================= */
let dbPromise: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

async function dbPut(key: string, blob: Blob, invalidate = true) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  if (invalidate) dropCachedURL(key);
}

async function dbDelete(key: string) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  dropCachedURL(key);
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
function dropCachedURL(key: string) {
  const url = cache.get(key);
  if (url) URL.revokeObjectURL(url);
  cache.delete(key);
}
let remoteKeys = new Set<string>();
let localKeys = new Set<string>();
let availableKeys = new Set<string>();
let cloudOnline = false;
let localLoaded = false;
let listLoaded = false;
let refreshPending: Promise<{ cloud: boolean; count: number }> | null = null;
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
export function refreshKeys(): Promise<{ cloud: boolean; count: number }> {
  if (refreshPending) return refreshPending;
  refreshPending = (async () => {
    if (!localLoaded) {
      localKeys = new Set(await listSoundKeys());
      localLoaded = true;
    }
    try {
      const res = await fetch("/api/sounds", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!Array.isArray(data.sounds)) throw new Error();
      const newKeys = new Set<string>(data.sounds.map((item: { key: string }) => String(item.key)));

      // حذف النسخ المحلية للأصوات التي حُذفت أو استُبدلت على جهاز آخر.
      for (const key of remoteKeys) {
        if (!newKeys.has(key) && localKeys.has(key)) {
          await dbDelete(key);
          localKeys.delete(key);
        }
      }
      for (const item of data.sounds) {
        const key = String(item.key);
        const version = String(item.updatedAt || item.updated_at || "");
        if (version && version !== getSavedVersion(key)) {
          if (localKeys.has(key)) {
            await dbDelete(key);
            localKeys.delete(key);
          }
          saveVersion(key, version);
        }
        remoteVersions.set(key, version);
      }
      remoteKeys = newKeys;
      if (typeof data.maxBytes === "number" && data.maxBytes > 0) maxBytes = data.maxBytes;
      cloudOnline = true;
    } catch {
      cloudOnline = false;
    }
    listLoaded = true;
    availableKeys = new Set([...localKeys, ...remoteKeys]);
    notify();
    return { cloud: cloudOnline, count: remoteKeys.size };
  })().finally(() => { refreshPending = null; });
  return refreshPending;
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
  cache.set(key, URL.createObjectURL(blob));
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
      const data = await res.json();
      remoteKeys.add(key);
      if (data.updatedAt) {
        const version = String(data.updatedAt);
        remoteVersions.set(key, version);
        saveVersion(key, version);
      }
      uploaded++;
    } catch {
      failed++;
    }
  }
  cloudOnline = uploaded > 0 || cloudOnline;
  notify();
  return { uploaded, failed };
}

/* ================= بث الصوت وتهيئته ================= */
function remoteURL(key: string) {
  const version = remoteVersions.get(key);
  const params = new URLSearchParams({ key });
  if (version) params.set("v", version);
  return `/api/sounds?${params.toString()}`;
}

/** رابط جاهز فوراً للمشغّل، دون انتظار تنزيل الملف كاملاً. */
export function getReadySoundURL(key: string): string | null {
  return cache.get(key) || (remoteKeys.has(key) && cloudOnline ? remoteURL(key) : null);
}

export async function getSoundURL(key: string): Promise<string | null> {
  if (cache.has(key)) return cache.get(key)!;
  if (localKeys.has(key)) {
    const blob = await dbGet(key);
    if (blob) {
      const url = URL.createObjectURL(blob);
      cache.set(key, url);
      return url;
    }
  }

  if (remoteKeys.has(key) && cloudOnline) return remoteURL(key);

  // ينتظر قائمة المفاتيح مرة واحدة فقط، ثم يفتح رابط الملف المباشر.
  if (!listLoaded) await refreshKeys();
  return getReadySoundURL(key);
}

let warmController: AbortController | null = null;

/** تهيئة صوت الشريحة الحالية والتالية في الخلفية بدون حجب زر التشغيل. */
export function warmSounds(keys: string[]) {
  warmController?.abort();
  const controller = new AbortController();
  warmController = controller;
  void (async () => {
    await refreshKeys();
    for (const key of keys) {
      if (controller.signal.aborted) return;
      if (cache.has(key)) continue;
      if (localKeys.has(key)) {
        await getSoundURL(key);
        continue;
      }
      if (!remoteKeys.has(key)) continue;
      const version = remoteVersions.get(key);
      try {
        // fetch دون Range لتُخزَّن النسخة في CDN ثم في المتصفح.
        const res = await fetch(remoteURL(key), { signal: controller.signal });
        if (!res.ok || !(res.headers.get("content-type") || "").startsWith("audio/")) continue;
        const blob = await res.blob();
        if (!blob.size || controller.signal.aborted || !remoteKeys.has(key) || remoteVersions.get(key) !== version) continue;
        await dbPut(key, blob, false);
        if (controller.signal.aborted || remoteVersions.get(key) !== version) {
          await dbDelete(key);
          continue;
        }
        cache.set(key, URL.createObjectURL(blob));
        localKeys.add(key);
        availableKeys.add(key);
      } catch {
        // فشل التهيئة لا يمنع التشغيل؛ يبقى رابط البث المباشر متاحاً.
      }
    }
  })();
}

// تحميل القائمة عند بدء التطبيق ليعرف المتصفح الأصوات المتاحة سحابياً
void refreshKeys();

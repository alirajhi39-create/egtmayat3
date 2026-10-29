import { hasCustom, getSoundURL } from "./soundStore";

/* ===================================================================
   محرك الصوت المركزي
   - مشغّل واحد لكل الملفات مع تسجيل الجارية لإيقافها فوراً
   - إيقاف تلقائي عند تشغيل أي صوت آخر أو عند الانتقال بين الشرائح
   - ذاكرة مؤقتة للروابط + تحميل مسبق لتقليل التأخر
   =================================================================== */

/* ============ مؤثرات Web Audio ============ */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.2
) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.linearRampToValueAtTime(volume, ac.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.05);
}

/* ===================================================================
   مشغّل الصوت الموحّد
   =================================================================== */
type ActiveSound = { audio: HTMLAudioElement; stop: () => void };

const activeSounds = new Set<ActiveSound>();

/** يوقف كل الأصوات الجارية فوراً (عند الانتقال أو تشغيل صوت آخر) */
export function stopAllSounds() {
  activeSounds.forEach((s) => {
    try {
      s.stop();
    } catch {}
  });
  activeSounds.clear();
}

function registerSound(audio: HTMLAudioElement): ActiveSound {
  const entry: ActiveSound = {
    audio,
    stop: () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    },
  };
  activeSounds.add(entry);
  const cleanup = () => activeSounds.delete(entry);
  audio.addEventListener("ended", cleanup);
  audio.addEventListener("error", cleanup);
  return entry;
}

/** هل يوجد صوت جارٍ الآن؟ */
export function hasPlayingSound(): boolean {
  for (const s of activeSounds) {
    if (!s.audio.paused && !s.audio.ended) return true;
  }
  return false;
}

/* ===================================================================
   تشغيل ملف صوتي (محلي أو سحابي)
   =================================================================== */
const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export async function fetchSoundURL(key: string): Promise<string | null> {
  if (urlCache.has(key)) return urlCache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = getSoundURL(key)
    .then((url) => {
      if (url) urlCache.set(key, url);
      inflight.delete(key);
      return url;
    })
    .catch(() => {
      inflight.delete(key);
      return null;
    });

  inflight.set(key, p);
  return p;
}

/**
 * تشغيل صوت. exclusive (افتراضي true) يوقف أي صوت جارٍ قبل البدء.
 */
export async function playSound(
  key: string,
  opts: { exclusive?: boolean; volume?: number; onEnd?: () => void } = {}
): Promise<boolean> {
  const { exclusive = true, volume = 1, onEnd } = opts;

  if (exclusive) stopAllSounds();

  const url = await fetchSoundURL(key);
  if (!url) {
    onEnd?.();
    return false;
  }

  const audio = new Audio(url);
  audio.volume = volume;
  audio.preload = "auto";
  const entry = registerSound(audio);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (played: boolean) => {
      if (settled) return;
      settled = true;
      activeSounds.delete(entry);
      onEnd?.();
      resolve(played);
    };
    audio.addEventListener("ended", () => finish(true));
    audio.addEventListener("error", () => finish(false));
    audio.play()
      .then(() => {})
      .catch(() => finish(false));
  });
}

/** تحميل مسبق للملفات (تقليل التأخر عند أول تشغيل) */
export function preloadSounds(keys: string[]) {
  keys.forEach((k) => {
    if (!urlCache.has(k) && !inflight.has(k)) void fetchSoundURL(k);
  });
}

/* ===================================================================
   المؤثرات الصوتية
   =================================================================== */
export async function playClick() {
  if (hasCustom("sfx-click")) {
    void playSound("sfx-click", { exclusive: false, volume: 0.7 });
    return;
  }
  try {
    tone(650, 0, 0.08, "triangle", 0.15);
    tone(900, 0.04, 0.08, "triangle", 0.1);
  } catch {}
}

export async function playFlip() {
  if (hasCustom("sfx-flip")) {
    void playSound("sfx-flip", { exclusive: false, volume: 0.8 });
    return;
  }
  try {
    tone(420, 0, 0.1, "sine", 0.15);
    tone(620, 0.07, 0.12, "sine", 0.15);
  } catch {}
}

export async function playCorrect() {
  if (hasCustom("sfx-correct")) {
    void playSound("sfx-correct", { exclusive: false, volume: 0.9 });
    return;
  }
  try {
    tone(523.25, 0, 0.15, "sine", 0.22);
    tone(659.25, 0.12, 0.15, "sine", 0.22);
    tone(783.99, 0.24, 0.3, "sine", 0.22);
  } catch {}
}

export async function playWrong() {
  if (hasCustom("sfx-wrong")) {
    void playSound("sfx-wrong", { exclusive: false, volume: 0.9 });
    return;
  }
  try {
    tone(220, 0, 0.2, "sawtooth", 0.12);
    tone(175, 0.18, 0.3, "sawtooth", 0.12);
  } catch {}
}

export async function playSuccess() {
  if (hasCustom("sfx-success")) {
    void playSound("sfx-success", { exclusive: false, volume: 0.95 });
    return;
  }
  try {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    notes.forEach((n, i) => tone(n, i * 0.1, 0.25, "sine", 0.2));
    tone(1318.5, 0.65, 0.5, "sine", 0.18);
  } catch {}
}

export async function playReveal() {
  if (hasCustom("sfx-reveal")) {
    void playSound("sfx-reveal", { exclusive: false, volume: 0.8 });
    return;
  }
  try {
    tone(880, 0, 0.1, "sine", 0.15);
    tone(1174.66, 0.08, 0.18, "sine", 0.15);
  } catch {}
}

/* ===================================================================
   التعليق الصوتي (قراءة آلية بالعربية)
   =================================================================== */
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;
let playToken = 0;

function pickArabicVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "ar-SA") ||
    voices.find((v) => v.lang.startsWith("ar")) ||
    null
  );
}

function speakTTS(text: string, onEnd?: () => void) {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-SA";
    const voice = pickArabicVoice();
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.pitch = 1;
    u.onend = () => {
      currentUtterance = null;
      onEnd?.();
    };
    u.onerror = () => {
      currentUtterance = null;
      onEnd?.();
    };
    currentUtterance = u;
    synth.speak(u);
  } catch {
    onEnd?.();
  }
}

/**
 * تشغيل تعليق صوتي:
 * - إن وُجد ملف مخصص (محلي أو سحابي) تحت narrationKey → يُشغَّل الملف
 * - وإلا تُستخدم القراءة الآلية العربية
 * أي تشغيل جديد يوقف الصوت السابق تلقائياً.
 */
export function speak(text: string, onEnd?: () => void, narrationKey?: string) {
  stopSpeaking();
  const token = ++playToken;

  if (narrationKey) {
    void fetchSoundURL(narrationKey).then((url) => {
      if (token !== playToken) return; // أُوقف أو انتقل المستخدم
      if (!url) {
        speakTTS(text, onEnd);
        return;
      }
      const audio = new Audio(url);
      audio.preload = "auto";
      currentAudio = audio;
      const entry = registerSound(audio);
      let settled = false;
      const finish = (fallback: boolean) => {
        if (settled) return;
        settled = true;
        activeSounds.delete(entry);
        if (currentAudio === audio) currentAudio = null;
        if (fallback && token === playToken) speakTTS(text, onEnd);
        else onEnd?.();
      };
      audio.addEventListener("ended", () => finish(false));
      audio.addEventListener("error", () => finish(true));
      audio.play().catch(() => finish(true));
    });
    return;
  }

  speakTTS(text, onEnd);
}

/** إيقاف أي قراءة أو ملف تعليق جارٍ */
export function stopSpeaking() {
  playToken++;
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    window.speechSynthesis.cancel();
    currentUtterance = null;
  } catch {}
  stopAllSounds();
}

export function isSpeaking(): boolean {
  return (currentUtterance !== null && window.speechSynthesis.speaking) || hasPlayingSound();
}

/* تحميل الأصوات مبكراً */
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

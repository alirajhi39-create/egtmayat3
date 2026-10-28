import { hasCustom, playCustom } from "./soundStore";

// ==== المؤثرات الصوتية باستخدام Web Audio API ====
let ctx: AudioContext | null = null;

/** يشغّل ملف المعلم المخصص إن وُجد ويعيد true */
function custom(key: string): boolean {
  if (hasCustom(key)) {
    void playCustom(key);
    return true;
  }
  return false;
}

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

/** صوت نقرة خفيفة عند التنقل */
export function playClick() {
  if (custom("sfx-click")) return;
  try {
    tone(650, 0, 0.08, "triangle", 0.15);
    tone(900, 0.04, 0.08, "triangle", 0.1);
  } catch {}
}

/** صوت قلب بطاقة */
export function playFlip() {
  if (custom("sfx-flip")) return;
  try {
    tone(420, 0, 0.1, "sine", 0.15);
    tone(620, 0.07, 0.12, "sine", 0.15);
  } catch {}
}

/** صوت إجابة صحيحة */
export function playCorrect() {
  if (custom("sfx-correct")) return;
  try {
    tone(523.25, 0, 0.15, "sine", 0.22); // دو
    tone(659.25, 0.12, 0.15, "sine", 0.22); // مي
    tone(783.99, 0.24, 0.3, "sine", 0.22); // صول
  } catch {}
}

/** صوت إجابة خاطئة */
export function playWrong() {
  if (custom("sfx-wrong")) return;
  try {
    tone(220, 0, 0.2, "sawtooth", 0.12);
    tone(175, 0.18, 0.3, "sawtooth", 0.12);
  } catch {}
}

/** صوت احتفال / نجاح */
export function playSuccess() {
  if (custom("sfx-success")) return;
  try {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    notes.forEach((n, i) => tone(n, i * 0.1, 0.25, "sine", 0.2));
    tone(1318.5, 0.65, 0.5, "sine", 0.18);
  } catch {}
}

/** صوت فتح عنصر / كشف معلومة */
export function playReveal() {
  if (custom("sfx-reveal")) return;
  try {
    tone(880, 0, 0.1, "sine", 0.15);
    tone(1174.66, 0.08, 0.18, "sine", 0.15);
  } catch {}
}

// ==== التعليق الصوتي (قراءة آلية بالعربية) ====
let currentUtterance: SpeechSynthesisUtterance | null = null;

function pickArabicVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "ar-SA") ||
    voices.find((v) => v.lang.startsWith("ar")) ||
    null
  );
}

let currentAudio: HTMLAudioElement | null = null;

/**
 * قراءة نص بصوت عربي، أو تشغيل ملف تعليق صوتي مسجل من المعلم إذا توفر
 * تحت المفتاح narrationKey (مثل "voice-slide-3").
 */
export function speak(text: string, onEnd?: () => void, narrationKey?: string) {
  stopSpeaking();
  if (narrationKey && hasCustom(narrationKey)) {
    void playCustom(narrationKey, () => {
      currentAudio = null;
      onEnd?.();
    }).then((a) => {
      currentAudio = a;
    });
    return;
  }
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

/** إيقاف أي قراءة أو ملف تعليق جارٍ */
export function stopSpeaking() {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    window.speechSynthesis.cancel();
    currentUtterance = null;
  } catch {}
}

export function isSpeaking(): boolean {
  return currentUtterance !== null && window.speechSynthesis.speaking;
}

// تحميل الأصوات مبكراً (بعض المتصفحات تحتاج ذلك)
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

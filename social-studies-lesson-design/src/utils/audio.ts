import { getReadySoundURL, getSoundURL, hasCustom } from "./soundStore";

let ctx: AudioContext | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
const activeTones = new Set<OscillatorNode>();
let currentMode: "speech" | "effect" | null = null;
let onPlaybackEnd: (() => void) | null = null;
let playbackToken = 0;

function finish(expected: number) {
  if (expected !== playbackToken) return;
  currentAudio = null;
  currentUtterance = null;
  currentMode = null;
  const done = onPlaybackEnd;
  onPlaybackEnd = null;
  done?.();
}

/** يوقف القراءة والملفات والمؤثرات، ويلغي أي تشغيل ما زال ينتظر الشبكة. */
export function stopAllAudio() {
  playbackToken++;
  const done = onPlaybackEnd;
  onPlaybackEnd = null;
  currentMode = null;
  const audio = currentAudio;
  currentAudio = null;
  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load(); // يلغي تنزيل الملف الجاري على الأجهزة البطيئة
    } catch { /* قد يكون الملف لم يبدأ التحميل بعد */ }
  }
  if (currentUtterance) {
    currentUtterance.onend = null;
    currentUtterance.onerror = null;
    currentUtterance = null;
  }
  try { window.speechSynthesis.cancel(); } catch { /* متصفح بلا نطق آلي */ }
  for (const oscillator of activeTones) {
    try { oscillator.stop(); } catch { /* انتهى المؤثر بالفعل */ }
  }
  activeTones.clear();
  done?.();
}

/** لا يوقف مؤثر التنقل إن كانت الشريحة القديمة في طور الإزالة. */
export function stopSpeaking() {
  if (currentMode === "speech") stopAllAudio();
}

function start(mode: "speech" | "effect", onEnd?: () => void) {
  stopAllAudio();
  currentMode = mode;
  onPlaybackEnd = onEnd || null;
  return playbackToken;
}

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  delay: number,
  duration: number,
  expected: number,
  type: OscillatorType = "sine",
  volume = 0.2
) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
  gain.gain.setValueAtTime(0.0001, ac.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, ac.currentTime + delay + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  activeTones.add(osc);
  osc.onended = () => {
    activeTones.delete(osc);
    osc.disconnect();
    gain.disconnect();
    if (activeTones.size === 0 && currentMode === "effect") finish(expected);
  };
  osc.start(ac.currentTime + delay);
  osc.stop(ac.currentTime + delay + duration + 0.05);
}

function playSource(src: string, expected: number, fallback: () => void) {
  if (expected !== playbackToken) return;
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = src;
  currentAudio = audio;
  let failed = false;
  const fail = () => {
    if (failed || expected !== playbackToken) return;
    failed = true;
    audio.onended = null;
    audio.onerror = null;
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch { /* لم يبدأ التشغيل */ }
    if (currentAudio === audio) currentAudio = null;
    fallback();
  };
  audio.onended = () => finish(expected);
  audio.onerror = fail;
  // عندما يكون الرابط جاهزاً يبدأ play داخل حدث الضغط، دون انتظار تنزيل الملف.
  void audio.play().catch(fail);
}

function loadFile(key: string, expected: number, fallback: () => void) {
  const ready = getReadySoundURL(key);
  if (ready) {
    playSource(ready, expected, fallback);
    return;
  }
  void getSoundURL(key).then((src) => {
    if (expected !== playbackToken) return;
    if (src) playSource(src, expected, fallback);
    else fallback();
  }).catch(() => {
    if (expected === playbackToken) fallback();
  });
}

function effect(key: string, notes: (expected: number) => void) {
  const expected = start("effect");
  const fallback = () => {
    if (expected !== playbackToken) return;
    try { notes(expected); } catch { finish(expected); }
  };
  if (hasCustom(key)) loadFile(key, expected, fallback);
  else fallback();
}

/** تشغيل ملف مخصص في إدارة الأصوات، مع إيقاف أي ملف قبله. */
export function previewSound(key: string) {
  const expected = start("effect");
  loadFile(key, expected, () => finish(expected));
}

export function playClick() {
  effect("sfx-click", (id) => {
    tone(650, 0, 0.08, id, "triangle", 0.15);
    tone(900, 0.04, 0.08, id, "triangle", 0.1);
  });
}

export function playFlip() {
  effect("sfx-flip", (id) => {
    tone(420, 0, 0.1, id, "sine", 0.15);
    tone(620, 0.07, 0.12, id, "sine", 0.15);
  });
}

export function playCorrect() {
  effect("sfx-correct", (id) => {
    tone(523.25, 0, 0.15, id, "sine", 0.22);
    tone(659.25, 0.12, 0.15, id, "sine", 0.22);
    tone(783.99, 0.24, 0.3, id, "sine", 0.22);
  });
}

export function playWrong() {
  effect("sfx-wrong", (id) => {
    tone(220, 0, 0.2, id, "sawtooth", 0.12);
    tone(175, 0.18, 0.3, id, "sawtooth", 0.12);
  });
}

export function playSuccess() {
  effect("sfx-success", (id) => {
    [523.25, 587.33, 659.25, 783.99, 880, 1046.5].forEach((n, i) => tone(n, i * 0.1, 0.25, id));
    tone(1318.5, 0.65, 0.5, id, "sine", 0.18);
  });
}

export function playReveal() {
  effect("sfx-reveal", (id) => {
    tone(880, 0, 0.1, id, "sine", 0.15);
    tone(1174.66, 0.08, 0.18, id, "sine", 0.15);
  });
}

function pickArabicVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "ar-SA") || voices.find((v) => v.lang.startsWith("ar")) || null;
}

function speakTTS(text: string, expected: number) {
  if (expected !== playbackToken) return;
  try {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    const voice = pickArabicVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    currentUtterance = utterance;
    utterance.onend = () => finish(expected);
    utterance.onerror = () => finish(expected);
    synth.speak(utterance);
  } catch {
    finish(expected);
  }
}

/** قراءة النص أو بث ملف المعلم المخصص، ملف واحد فقط في كل مرة. */
export function speak(text: string, onEnd?: () => void, narrationKey?: string) {
  const expected = start("speech", onEnd);
  if (narrationKey) loadFile(narrationKey, expected, () => speakTTS(text, expected));
  else speakTTS(text, expected);
}

export function isSpeaking() {
  return currentMode === "speech";
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

import { useEffect, useState } from "react";
import { putSound, deleteSound, listSoundKeys, playCustom, refreshKeys } from "../utils/soundStore";
import { playClick, playCorrect, playWrong, playSuccess, playFlip, playReveal, speak } from "../utils/audio";
import { QUESTIONS } from "./Quiz";

const SFX = [
  { key: "sfx-click", label: "نقرة التنقل", icon: "👆", preview: playClick },
  { key: "sfx-flip", label: "قلب البطاقة", icon: "🃏", preview: playFlip },
  { key: "sfx-reveal", label: "كشف المعلومة", icon: "🎁", preview: playReveal },
  { key: "sfx-correct", label: "إجابة صحيحة", icon: "✅", preview: playCorrect },
  { key: "sfx-wrong", label: "إجابة خاطئة", icon: "❌", preview: playWrong },
  { key: "sfx-success", label: "نجاح واحتفال", icon: "🎉", preview: playSuccess },
];

/* أصوات أسئلة التقويم — لكل سؤال مفتاح وملف مستقل */
const QUESTIONS_LIST: { key: string; label: string; text: string }[] = QUESTIONS.map((q, i) => ({
  key: `voice-slide-13-q${i + 1}`,
  label: `السؤال ${i + 1}`,
  text: `السؤال ${i + 1}: ${q.q} الخيارات هي: ${q.options.join("، ")}`,
}));

const SLIDES = [
  "الغلاف والأهداف", "التهيئة", "بعد سقوط الدرعية", "المؤسس الجديد",
  "أسباب العودة", "نشاط ١", "أئمة الدولة", "الإمام تركي",
  "صفات الإمام", "العاصمة الجديدة", "نشاط ٢", "نشاط ٣",
  "للاطلاع", "التقويم", "النتيجة النهائية",
];

export function AudioManager() {
  const [keys, setKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState("");

  const reload = async () => {
    await refreshKeys();
    setKeys(await listSoundKeys());
  };
  useEffect(() => { void reload(); }, []);

  const upload = async (key: string, file: File | undefined) => {
    if (!file) return;
    setBusy(key);
    await putSound(key, file);
    await reload();
    setBusy("");
  };

  const Row = ({ k, label, icon, preview, hint }: { k: string; label: string; icon: string; preview?: () => void; hint?: string }) => {
    const has = keys.includes(k);
    return (
      <div className={`rounded-xl border-2 p-3 flex flex-wrap items-center gap-3 ${has ? "bg-teal-50 border-teal-300" : "bg-white border-slate-200"}`}>
        <span className="text-xl">{icon}</span>
        <span className="flex-1 min-w-32">
          <span className="block font-extrabold text-slate-700 text-sm">{label}</span>
          {hint && <span className="block text-slate-400 font-bold text-[11px] leading-snug mt-0.5 line-clamp-2">{hint}</span>}
        </span>
        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${has ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"}`}>
          {has ? "ملف مخصص ✅" : "الصوت الافتراضي"}
        </span>
        <button
          onClick={() => (has ? void playCustom(k) : preview?.())}
          className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-sm font-bold"
        >
          ▶️ تجربة
        </button>
        <label className="rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 text-sm font-bold cursor-pointer">
          {busy === k ? "⏳" : "📤 رفع"}
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => upload(k, e.target.files?.[0])} />
        </label>
        {has && (
          <button
            onClick={async () => { await deleteSound(k); await reload(); }}
            className="rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 text-sm font-bold"
          >
            🗑️
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
        <h3 className="font-extrabold text-amber-900 mb-2">🎙️ كيف أستخدم أصواتي الخاصة؟</h3>
        <p className="text-amber-900 font-semibold text-sm leading-relaxed">
          ارفع أي ملف صوتي (MP3 / WAV / M4A / OGG) ليحل محل الصوت الافتراضي. تُحفظ الملفات داخل متصفح هذا الجهاز
          (IndexedDB) ولا تُرفع للإنترنت، لذا احرص على رفعها على الجهاز المستخدم في العرض. يمكنك تسجيل تعليقك الصوتي
          بصوتك لكل شريحة ليسمعه الطلاب بدلاً من القراءة الآلية.
        </p>
      </div>

      <section>
        <h3 className="text-xl font-extrabold text-teal-800 mb-3">🔔 المؤثرات الصوتية</h3>
        <div className="space-y-2">
          {SFX.map((s) => <Row key={s.key} k={s.key} label={s.label} icon={s.icon} preview={s.preview} />)}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-xl font-extrabold text-teal-800">🎯 أصوات أسئلة التقويم — كل سؤال ملف مستقل</h3>
          <span className="rounded-full bg-teal-100 text-teal-800 px-3 py-1 text-xs font-black">
            مرفوع: {QUESTIONS_LIST.filter((q) => keys.includes(q.key)).length} / {QUESTIONS_LIST.length}
          </span>
        </div>
        <p className="text-slate-500 font-bold text-sm mb-3">
          ارفع مقطعاً صوتياً لكل سؤال من أسئلة التقويم الثمانية على حدة. عند فتح السؤال يشتغل ملفه المخصص تلقائياً
          عند الضغط على «🔊 استمع للسؤال»، بدلاً من القراءة الآلية.
        </p>
        <div className="space-y-2">
          {QUESTIONS_LIST.map((q) => (
            <Row
              key={q.key}
              k={q.key}
              label={q.label}
              icon="❓"
              hint={q.text}
              preview={() => speak(q.text, undefined, q.key)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-extrabold text-rose-800 mb-1">🎧 التعليق الصوتي لكل شريحة</h3>
        <p className="text-slate-500 font-bold text-sm mb-3">عند رفع ملف لشريحة، يُشغَّل بدل القراءة الآلية عند ضغط زر «استمع للشرح».</p>
        <div className="space-y-2">
          {SLIDES.map((name, i) => (
            <Row key={i} k={`voice-slide-${i}`} label={`شريحة ${i + 1}: ${name}`} icon="🎤" />
          ))}
          <Row k="voice-slide-13-اقرأ السؤال" label="قراءة أسئلة التقويم (اختياري)" icon="📢" />
        </div>
      </section>
    </div>
  );
}

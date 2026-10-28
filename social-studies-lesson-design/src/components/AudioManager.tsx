import { useEffect, useState } from "react";
import {
  putSound,
  deleteSound,
  listSoundKeys,
  refreshKeys,
  isCloud,
  isCloudOnline,
  getLastError,
  getMaxBytes,
  syncLocalToCloud,
  onSoundsChanged,
} from "../utils/soundStore";
import { playClick, playCorrect, playWrong, playSuccess, playFlip, playReveal, speak, previewSound, stopAllAudio } from "../utils/audio";
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
  const [cloud, setCloud] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [seed, setSeed] = useState(0);

  const reload = async () => {
    await refreshKeys();
    setKeys(await listSoundKeys());
    setCloud(isCloudOnline());
  };

  useEffect(() => {
    void reload();
    const off = onSoundsChanged(() => setSeed((s) => s + 1));
    return () => {
      off();
      stopAllAudio();
    };
  }, []);

  const upload = async (key: string, file: File | undefined) => {
    if (!file) return;
    stopAllAudio();
    setBusy(key);
    setMessage(null);
    try {
      const res = await putSound(key, file);
      if (res.synced) setMessage({ type: "ok", text: "تم رفع الملف بنجاح، وأصبح متاحاً على جميع الأجهزة ✅" });
      else
        setMessage({
          type: "err",
          text: `حُفظ على هذا الجهاز فقط. سبب عدم الرفع للسحابة: ${res.error || getLastError() || "غير معروف"}`,
        });
    } catch (e: any) {
      setMessage({ type: "err", text: e?.message || "تعذّر رفع الملف" });
    }
    await reload();
    setBusy("");
  };

  const syncAll = async () => {
    setSyncing(true);
    setMessage(null);
    const r = await syncLocalToCloud();
    await reload();
    setSyncing(false);
    setMessage(
      r.uploaded > 0
        ? { type: "ok", text: `تمت مزامنة ${r.uploaded} ملفاً مع السحابة ✅${r.failed ? ` وفشل ${r.failed}` : ""}` }
        : { type: "err", text: "لا توجد ملفات محلية بحاجة للمزامنة أو أن السحابة غير متاحة." }
    );
  };

  const Row = ({ k, label, icon, preview, hint }: { k: string; label: string; icon: string; preview?: () => void; hint?: string }) => {
    const local = keys.includes(k);
    const inCloud = isCloud(k);
    const has = local || inCloud;
    return (
      <div className={`rounded-xl border-2 p-3 flex flex-wrap items-center gap-2 sm:gap-3 ${has ? "bg-teal-50 border-teal-300" : "bg-white border-slate-200"}`} data-seed={seed}>
        <span className="text-xl">{icon}</span>
        <span className="flex-1 min-w-32">
          <span className="block font-extrabold text-slate-700 text-sm">{label}</span>
          {hint && <span className="block text-slate-400 font-bold text-[11px] leading-snug mt-0.5 line-clamp-2">{hint}</span>}
        </span>
        <span
          className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
            inCloud ? "bg-teal-600 text-white" : local ? "bg-amber-400 text-amber-950" : "bg-slate-100 text-slate-500"
          }`}
        >
          {inCloud ? "☁️ على كل الأجهزة" : local ? "📱 هذا الجهاز فقط" : "الصوت الافتراضي"}
        </span>
        <button
          onClick={() => (has ? previewSound(k) : preview?.())}
          className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-sm font-bold"
        >
          ▶️ تجربة
        </button>
        <label className="rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 text-sm font-bold cursor-pointer">
          {busy === k ? "⏳ جارٍ الرفع…" : has ? "📤 استبدال" : "📤 رفع"}
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => upload(k, e.target.files?.[0])} />
        </label>
        {has && (
          <button
            onClick={async () => {
              if (!confirm("حذف هذا الملف من كل الأجهزة؟")) return;
              stopAllAudio();
              await deleteSound(k);
              await reload();
              setMessage({ type: "ok", text: "تم حذف الملف من السحابة وهذا الجهاز." });
            }}
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
      {/* حالة السحابة */}
      <div className={`rounded-2xl p-4 border-2 flex flex-wrap items-center gap-3 ${cloud ? "bg-teal-50 border-teal-300" : "bg-amber-50 border-amber-300"}`}>
        <span className="text-2xl">{cloud ? "☁️" : "⚠️"}</span>
        <div className="flex-1 min-w-48">
          <p className={`font-extrabold ${cloud ? "text-teal-900" : "text-amber-900"}`}>
            {cloud ? "الأصوات مرفوعة على السحابة وتعمل على جميع الأجهزة" : "قاعدة البيانات غير متاحة — الحفظ على هذا الجهاز فقط"}
          </p>
          <p className={`text-xs font-bold mt-0.5 ${cloud ? "text-teal-700" : "text-amber-800"}`}>
            الحد الأقصى للملف: {Math.round(getMaxBytes() / 1048576)} ميجابايت • الصيغ: MP3 / WAV / M4A / OGG
          </p>
        </div>
        <button
          onClick={syncAll}
          disabled={syncing}
          className="rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-extrabold hover:bg-teal-800 disabled:opacity-50"
        >
          {syncing ? "⏳ جارٍ المزامنة…" : "🔄 مزامنة الملفات المحلية"}
        </button>
      </div>

      {message && (
        <div className={`rounded-xl p-3 font-bold text-sm border-2 ${message.type === "ok" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-rose-50 border-rose-300 text-rose-800"}`}>
          {message.text}
        </div>
      )}

      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
        <h3 className="font-extrabold text-amber-900 mb-2">🎙️ كيف أستخدم أصواتي الخاصة؟</h3>
        <p className="text-amber-900 font-semibold text-sm leading-relaxed">
          ارفع أي ملف صوتي ليحل محل الصوت الافتراضي. يُرفع الملف إلى قاعدة بيانات Neon ويُصبح متاحاً لجميع الطلاب على
          مختلف الأجهزة، ويُخزَّن أيضاً في هذا المتصفح لتشغيل أسرع. إن كان الملف كبيراً فاضغط جودة التسجيل إلى ٦٤ kbps
          لتقليل الحجم.
        </p>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-xl font-extrabold text-teal-800">🎯 أصوات أسئلة التقويم — كل سؤال ملف مستقل</h3>
          <span className="rounded-full bg-teal-100 text-teal-800 px-3 py-1 text-xs font-black">
            مرفوع سحابياً: {QUESTIONS_LIST.filter((q) => isCloud(q.key)).length} / {QUESTIONS_LIST.length}
          </span>
        </div>
        <p className="text-slate-500 font-bold text-sm mb-3">
          ارفع مقطعاً صوتياً لكل سؤال من أسئلة التقويم الثمانية على حدة. يُشغَّل ملف السؤال تلقائياً عند الضغط على
          «🔊 استمع للسؤال» أثناء الاختبار.
        </p>
        <div className="space-y-2">
          {QUESTIONS_LIST.map((q) => (
            <Row key={q.key} k={q.key} label={q.label} icon="❓" hint={q.text} preview={() => speak(q.text, undefined, q.key)} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-extrabold text-teal-800 mb-3">🔔 المؤثرات الصوتية</h3>
        <div className="space-y-2">
          {SFX.map((s) => <Row key={s.key} k={s.key} label={s.label} icon={s.icon} preview={s.preview} />)}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-extrabold text-rose-800 mb-1">🎧 التعليق الصوتي لكل شريحة</h3>
        <p className="text-slate-500 font-bold text-sm mb-3">عند رفع ملف لشريحة، يُشغَّل بدل القراءة الآلية عند ضغط زر «استمع للشرح».</p>
        <div className="space-y-2">
          {SLIDES.map((name, i) => (
            <Row key={i} k={`voice-slide-${i}`} label={`شريحة ${i + 1}: ${name}`} icon="🎤" />
          ))}
        </div>
      </section>
    </div>
  );
}

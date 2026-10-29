import { createContext, useContext, useEffect, useState } from "react";
import { speak, stopSpeaking, playClick } from "../utils/audio";
import { getSession, recordActivity } from "../lib/progress";

/** سياق يحمل رقم الشريحة الحالية لربط ملفات التعليق الصوتي بها */
export const SlideContext = createContext(0);
export const useSlideIndex = () => useContext(SlideContext);

/** مفتاح ملف التعليق الصوتي لشريحة معينة */
export const narrationKey = (slide: number, variant?: string) =>
  variant ? `voice-slide-${slide}-${variant}` : `voice-slide-${slide}`;

/**
 * حقل إجابة نشاط: يعمل مثل useState لكنه يحفظ إجابة الطالب
 * في قاعدة البيانات / التخزين المحلي ليراها المعلم.
 */
export function useActivityAnswer(key: string, initial = "") {
  const [value, setValue] = useState(() => {
    const saved = getSession()?.activities?.[key];
    return typeof saved === "string" ? saved : initial;
  });
  const set = (v: string) => {
    setValue(v);
    // يُحفظ محلياً فور الكتابة؛ طبقة التقدم تجمع طلبات الشبكة بنفسها.
    recordActivity(key, v);
  };
  return [value, set] as const;
}

/** شارة الاستراتيجية التعليمية المستخدمة في الشريحة */
export function StrategyBadge({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 sm:px-4 sm:py-1.5 text-amber-800 text-xs sm:text-sm font-bold shadow-sm">
      <span className="text-base">{icon}</span>
      <span>استراتيجية: {name}</span>
    </div>
  );
}

/** زر التعليق الصوتي - يقرأ النص المرفق */
export function SpeakButton({
  text,
  label = "استمع للشرح",
  variant,
}: {
  text: string;
  label?: string;
  variant?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const slide = useSlideIndex();

  useEffect(() => {
    return () => stopSpeaking();
  }, [slide, variant]);

  const toggle = () => {
    playClick();
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speak(text, () => setSpeaking(false), narrationKey(slide, variant));
    }
  };

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-2 rounded-full px-4 sm:px-5 py-2.5 text-sm font-bold transition-all shadow-md ${
        speaking
          ? "bg-rose-600 text-white animate-pulse"
          : "bg-teal-600 text-white hover:bg-teal-700 hover:scale-105"
      }`}
    >
      {speaking ? (
        <>
          <span className="text-lg">⏹️</span> إيقاف القراءة
        </>
      ) : (
        <>
          <span className="text-lg">🔊</span> {label}
        </>
      )}
    </button>
  );
}

/** عنوان القسم بنمط الكتاب المدرسي */
export function SectionTitle({ children, icon = "❓" }: { children: React.ReactNode; icon?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-rose-700 text-white text-base sm:text-lg shadow-md shrink-0">
        {icon}
      </span>
      <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-rose-800 leading-snug">{children}</h2>
    </div>
  );
}

/** إطار الشريحة */
export function SlideCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl sm:rounded-3xl shadow-xl border-2 border-teal-100 p-4 sm:p-6 md:p-10 animate-slidein">
      {children}
    </div>
  );
}

/** شريط عنوان نشاط بنمط الكتاب */
export function ActivityHeader({ number }: { number: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-2xl">✏️</span>
      <div className="flex items-center gap-0 rounded-lg overflow-hidden border-2 border-rose-700 shadow-sm">
        <span className="bg-white px-4 py-1.5 font-extrabold text-rose-700 text-lg">نشاط</span>
        <span className="bg-rose-700 text-white px-4 py-1.5 font-extrabold text-lg">{number}</span>
      </div>
      <div className="flex-1 border-b-2 border-dashed border-rose-300" />
    </div>
  );
}

import { useState } from "react";
import { createSession } from "../lib/progress";
import { playSuccess, playClick } from "../utils/audio";

const CLASSES = ["٦/١", "٦/٢"];

export function StudentLogin({ onStart, onTeacher }: { onStart: () => void; onTeacher: () => void }) {
  const [name, setName] = useState("");
  const [cls, setCls] = useState(CLASSES[0]);
  const [error, setError] = useState("");

  const start = () => {
    if (name.trim().length < 3) {
      setError("فضلاً اكتب اسمك الثلاثي بشكل صحيح");
      return;
    }
    playSuccess();
    createSession(name.trim(), cls, 14);
    onStart();
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <img src="/images/hero-diriyah.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-teal-950/95 via-teal-900/90 to-rose-950/90" />

      <div className="relative w-full max-w-lg bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-5 sm:p-8 animate-slidein">
        <div className="text-center mb-7">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 text-3xl shadow-lg mb-3">🏰</span>
          <h1 className="text-2xl md:text-3xl font-black text-teal-900 leading-tight">تأسيس الدولة السعودية الثانية</h1>
          <p className="text-slate-500 font-bold text-sm mt-2">الدراسات الاجتماعية • الصف السادس • الدرس السابع</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-3 text-center">
            <p className="text-xs font-bold text-teal-600 mb-1">👨‍🏫 المعلم</p>
            <p className="font-black text-teal-900 text-sm leading-snug">علي عبدالله راجحي</p>
          </div>
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 text-center">
            <p className="text-xs font-bold text-amber-700 mb-1">🏫 المدرسة</p>
            <p className="font-black text-amber-900 text-sm leading-snug">مدرسة العروس الابتدائية</p>
          </div>
        </div>

        <label className="block font-extrabold text-slate-700 mb-2">👤 اسم الطالب (ثلاثي)</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && start()}
          placeholder="مثال: عبدالله محمد العتيبي"
          className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 font-bold focus:border-teal-500 focus:outline-none mb-4"
        />

        <label className="block font-extrabold text-slate-700 mb-2">🏫 الفصل</label>
        <div className="flex flex-wrap gap-2 mb-5">
          {CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => { playClick(); setCls(c); }}
              className={`rounded-xl px-4 py-2 font-extrabold border-2 transition-all ${
                cls === c ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-slate-300 text-slate-600 hover:border-teal-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {error && <p className="text-rose-600 font-bold mb-3 text-sm">⚠️ {error}</p>}

        <button
          onClick={start}
          className="w-full rounded-xl bg-rose-700 text-white font-black text-lg py-4 shadow-lg hover:bg-rose-800 hover:scale-[1.02] transition-all"
        >
          🚀 ابدأ الدرس
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-slate-400 font-bold text-xs">أو</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          onClick={() => { playClick(); onTeacher(); }}
          className="w-full rounded-xl bg-white border-2 border-teal-600 text-teal-800 font-extrabold py-3 hover:bg-teal-50 transition-colors"
        >
          👨‍🏫 دخول لوحة المعلم
        </button>

        <p className="text-center text-slate-400 text-xs font-bold mt-5">
          يُحفظ تقدمك تلقائياً ليتابعه معلمك 📊
        </p>
      </div>
    </div>
  );
}

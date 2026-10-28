import { useEffect, useMemo, useState } from "react";
import { fetchStudents, deleteAllRemote, toCSV, type StudentProgress } from "../lib/progress";
import { AudioManager } from "./AudioManager";
import { playClick } from "../utils/audio";

const TEACHER_PIN = "1234";

export function TeacherDashboard({ onExit }: { onExit: () => void }) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<"students" | "audio">("students");
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [source, setSource] = useState<"neon" | "local">("local");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetchStudents();
    setStudents(r.students);
    setSource(r.source);
    setLoading(false);
  };

  useEffect(() => {
    if (!authed) return;
    void load();
    const t = setInterval(() => void load(), 15000); // تحديث تلقائي كل ١٥ ثانية
    return () => clearInterval(t);
  }, [authed]);

  const filtered = useMemo(
    () => students.filter((s) => (s.studentName + s.className).includes(filter.trim())),
    [students, filter]
  );

  const stats = useMemo(() => {
    const n = students.length;
    const done = students.filter((s) => s.quizScore != null).length;
    const avgProg = n ? Math.round(students.reduce((a, s) => a + ((s.maxSlide + 1) / (s.totalSlides || 14)) * 100, 0) / n) : 0;
    const scored = students.filter((s) => s.quizScore != null);
    const avgScore = scored.length
      ? Math.round((scored.reduce((a, s) => a + (s.quizScore! / (s.quizTotal || 8)) * 100, 0) / scored.length))
      : 0;
    return { n, done, avgProg, avgScore };
  }, [students]);

  const exportCSV = () => {
    const blob = new Blob([toCSV(filtered)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `تقدم-الطلاب-الدولة-السعودية-الثانية.csv`;
    a.click();
  };

  /* ===== شاشة الرمز ===== */
  if (!authed) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-teal-950 to-rose-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-slidein">
          <div className="text-center mb-6">
            <span className="text-4xl">👨‍🏫</span>
            <h2 className="text-2xl font-black text-teal-900 mt-2">لوحة المعلم</h2>
            <p className="text-slate-500 font-bold text-sm">أدخل رمز الدخول</p>
          </div>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setAuthed(pin === TEACHER_PIN)}
            placeholder="••••"
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-center text-2xl font-black tracking-widest focus:border-teal-500 focus:outline-none mb-4"
          />
          {pin && pin !== TEACHER_PIN && <p className="text-rose-600 font-bold text-sm mb-3 text-center">الرمز غير صحيح</p>}
          <button
            onClick={() => setAuthed(pin === TEACHER_PIN)}
            className="w-full rounded-xl bg-teal-700 text-white font-black py-3 hover:bg-teal-800 transition-colors mb-3"
          >
            دخول
          </button>
          <button onClick={onExit} className="w-full rounded-xl bg-slate-100 text-slate-600 font-bold py-2.5 hover:bg-slate-200">
            → رجوع
          </button>
          <p className="text-center text-slate-400 text-xs font-bold mt-4">الرمز الافتراضي: 1234</p>
        </div>
      </div>
    );
  }

  /* ===== اللوحة ===== */
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      <header className="bg-teal-900 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-2xl">👨‍🏫</span>
            <div>
              <h1 className="font-black text-base sm:text-lg">لوحة المعلم — أ. علي عبدالله راجحي</h1>
              <p className="text-teal-200 text-[10px] sm:text-xs font-bold">مدرسة العروس الابتدائية • تأسيس الدولة السعودية الثانية — الصف السادس</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-black ${source === "neon" ? "bg-emerald-500" : "bg-amber-500 text-amber-950"}`}>
              {source === "neon" ? "● متصل بقاعدة Neon" : "● وضع محلي (بدون قاعدة بيانات)"}
            </span>
            <button onClick={onExit} className="rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2 font-bold text-sm">
              خروج
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2">
          {([["students", "📊 متابعة الطلاب"], ["audio", "🎙️ إدارة الأصوات"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => { playClick(); setTab(k); }}
              className={`rounded-xl px-4 py-2 font-extrabold text-sm transition-all ${tab === k ? "bg-amber-400 text-teal-950" : "bg-white/10 hover:bg-white/20"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "audio" ? (
          <AudioManager />
        ) : (
          <>
            {/* بطاقات الإحصاء */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                ["👥", "عدد الطلاب", stats.n, "teal"],
                ["🏁", "أنهوا الدرس", stats.done, "emerald"],
                ["📈", "متوسط التقدم", `${stats.avgProg}٪`, "amber"],
                ["🏆", "متوسط الدرجات", `${stats.avgScore}٪`, "rose"],
              ].map(([ic, label, val], i) => (
                <div key={i} className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
                  <span className="text-2xl">{ic as string}</span>
                  <p className="text-3xl font-black text-teal-800 mt-1">{val as string}</p>
                  <p className="font-bold text-slate-500 text-sm">{label as string}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="🔍 ابحث باسم الطالب أو الفصل…"
                className="flex-1 min-w-48 rounded-xl border-2 border-slate-300 px-4 py-2.5 font-bold focus:border-teal-500 focus:outline-none"
              />
              <button onClick={() => void load()} className="rounded-xl bg-teal-700 text-white font-bold px-4 py-2.5 hover:bg-teal-800">
                {loading ? "⏳ تحديث…" : "🔄 تحديث"}
              </button>
              <button onClick={exportCSV} className="rounded-xl bg-emerald-600 text-white font-bold px-4 py-2.5 hover:bg-emerald-700">
                📥 تصدير Excel
              </button>
              <button
                onClick={async () => {
                  if (confirm("حذف جميع سجلات الطلاب نهائياً؟")) { await deleteAllRemote(); void load(); }
                }}
                className="rounded-xl bg-rose-100 text-rose-700 font-bold px-4 py-2.5 hover:bg-rose-200"
              >
                🗑️ مسح الكل
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
                <span className="text-5xl">📭</span>
                <p className="font-extrabold text-slate-500 mt-3">لا توجد سجلات بعد — اطلب من الطلاب بدء الدرس بأسمائهم.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((s) => {
                  const pct = Math.round(((s.maxSlide + 1) / (s.totalSlides || 14)) * 100);
                  const isOpen = open === s.id;
                  return (
                    <div key={s.id} className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
                      <button
                        onClick={() => setOpen(isOpen ? null : s.id)}
                        className="w-full p-4 flex flex-wrap items-center gap-4 text-right hover:bg-slate-50"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-black">
                          {s.studentName.charAt(0)}
                        </span>
                        <div className="flex-1 min-w-40">
                          <p className="font-extrabold text-slate-800">{s.studentName}</p>
                          <p className="text-slate-500 font-bold text-xs">
                            الفصل {s.className || "—"} • آخر نشاط: {new Date(s.updatedAt).toLocaleString("ar-SA")}
                          </p>
                        </div>
                        <div className="w-full sm:w-40 order-last sm:order-none">
                          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-l from-teal-500 to-teal-700" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs font-black text-slate-500 mt-1">
                            {pct}٪ — شريحة {s.maxSlide + 1}/{s.totalSlides}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-black ${
                            s.quizScore != null
                              ? s.quizScore / (s.quizTotal || 8) >= 0.7
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {s.quizScore != null ? `الاختبار: ${s.quizScore}/${s.quizTotal ?? 8}` : "لم يُنجز الاختبار"}
                        </span>
                        <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
                      </button>
                      {isOpen && (
                        <div className="border-t-2 border-slate-100 p-4 bg-slate-50 animate-slidein">
                          <h4 className="font-extrabold text-teal-800 mb-3">📝 إجابات الأنشطة</h4>
                          {Object.keys(s.activities || {}).length === 0 ? (
                            <p className="text-slate-500 font-bold text-sm">لم يُسجل الطالب أي إجابة كتابية بعد.</p>
                          ) : (
                            <div className="space-y-2">
                              {Object.entries(s.activities).map(([k, v]) => (
                                <div key={k} className="bg-white rounded-xl border border-slate-200 p-3">
                                  <p className="font-extrabold text-rose-700 text-sm mb-1">{k}</p>
                                  <p className="font-semibold text-slate-700 text-sm whitespace-pre-wrap">
                                    {typeof v === "object" ? JSON.stringify(v, null, 1) : String(v) || "—"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  fetchStudents,
  deleteAllRemote,
  deleteStudentRemote,
  toCSV,
  type StudentProgress,
} from "../lib/progress";
import { AudioManager } from "./AudioManager";
import { playClick } from "../utils/audio";

const TEACHER_PIN = "1234";

function getGradeLevel(score: number | null, total: number | null) {
  if (score === null) return { text: "لم يُنجز", color: "text-slate-400" };
  const t = total || 8;
  const ratio = score / t;
  if (ratio >= 0.85) return { text: "ممتاز 🏆", color: "text-emerald-700 font-extrabold" };
  if (ratio >= 0.7) return { text: "جيد جداً ⭐", color: "text-teal-700 font-extrabold" };
  if (ratio >= 0.5) return { text: "جيد 👍", color: "text-amber-700 font-extrabold" };
  return { text: "يحتاج لمراجعة 📚", color: "text-rose-700 font-extrabold" };
}

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
    const avgProg = n
      ? Math.round(
          students.reduce((a, s) => a + ((s.maxSlide + 1) / (s.totalSlides || 14)) * 100, 0) / n
        )
      : 0;
    const scored = students.filter((s) => s.quizScore != null);
    const avgScore = scored.length
      ? Math.round(
          scored.reduce((a, s) => a + (s.quizScore! / (s.quizTotal || 8)) * 100, 0) / scored.length
        )
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

  /** حذف طالب محدد نهائياً */
  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف بيانات الطالب "${name}" نهائياً من قاعدة البيانات؟`)) return;
    await deleteStudentRemote(id);
    await load();
  };

  const [includeQuestionsInPrint, setIncludeQuestionsInPrint] = useState(false);

  /** طباعة التقرير كـ PDF مع خيار استبعاد الأسئلة أو تضمينها */
  const handlePrint = (withQuestions = false) => {
    setIncludeQuestionsInPrint(withQuestions);
    setTimeout(() => {
      window.print();
    }, 80);
  };

  /* ===== شاشة الرمز ===== */
  if (!authed) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-gradient-to-br from-teal-950 to-rose-950 flex items-center justify-center p-4"
      >
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
          {pin && pin !== TEACHER_PIN && (
            <p className="text-rose-600 font-bold text-sm mb-3 text-center">الرمز غير صحيح</p>
          )}
          <button
            onClick={() => setAuthed(pin === TEACHER_PIN)}
            className="w-full rounded-xl bg-teal-700 text-white font-black py-3 hover:bg-teal-800 transition-colors mb-3"
          >
            دخول
          </button>
          <button
            onClick={onExit}
            className="w-full rounded-xl bg-slate-100 text-slate-600 font-bold py-2.5 hover:bg-slate-200"
          >
            → رجوع
          </button>
          <p className="text-center text-slate-400 text-xs font-bold mt-4">الرمز الافتراضي: 1234</p>
        </div>
      </div>
    );
  }

  /* ===== اللوحة الرئيسية ===== */
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      {/* ================= تقرير الطباعة الرسمي لـ PDF (مخفي بالشاشة ويظهر فقط عند أمر الطباعة) ================= */}
      <div className="print-only p-4 bg-white text-slate-900" dir="rtl">
        {/* الترويسة الرسمية للتقرير */}
        <div className="border-b-2 border-slate-800 pb-4 mb-4">
          <div className="flex justify-between items-start text-xs font-bold text-slate-700">
            <div>
              <p>المملكة العربية السعودية</p>
              <p>وزارة التعليم</p>
              <p>مدرسة العروس الابتدائية</p>
            </div>
            <div className="text-center">
              <p className="text-base font-black text-slate-900">
                {includeQuestionsInPrint
                  ? "تقرير إنجاز الطلاب المفصل (مع إجابات الأسئلة والأنشطة)"
                  : "كشف درجات وإنجاز الطلاب (بدون الأسئلة)"}
              </p>
              <p className="text-sm font-extrabold text-teal-800 mt-0.5">
                تأسيس الدولة السعودية الثانية (الوحدة الثالثة • الدرس السابع)
              </p>
              <p className="text-xs text-slate-600">الدراسات الاجتماعية • الصف السادس الابتدائي</p>
            </div>
            <div className="text-left">
              <p>معلم المادة: أ. علي عبدالله راجحي</p>
              <p>تاريخ التقرير: {new Date().toLocaleDateString("ar-SA")}</p>
              <p>الفصل: {filter.trim() ? filter.trim() : "جميع الفصول (٦/١ - ٦/٢)"}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                نوع التقرير: {includeQuestionsInPrint ? "مفصل بالأسئلة" : "موجز الدرجات فقط"}
              </p>
            </div>
          </div>
        </div>

        {/* الملخص الإحصائي المطبوع */}
        <div className="grid grid-cols-4 gap-3 mb-5 text-center text-xs">
          <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50">
            <span className="block text-slate-500 font-bold">إجمالي الطلاب</span>
            <span className="block text-lg font-black text-slate-900 mt-1">{filtered.length} طالب</span>
          </div>
          <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50">
            <span className="block text-slate-500 font-bold">أنهوا الدرس كاملاً</span>
            <span className="block text-lg font-black text-emerald-700 mt-1">
              {filtered.filter((s) => s.quizScore != null).length} طالب
            </span>
          </div>
          <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50">
            <span className="block text-slate-500 font-bold">متوسط نسبة التقدم</span>
            <span className="block text-lg font-black text-amber-700 mt-1">
              {filtered.length
                ? Math.round(
                    filtered.reduce(
                      (a, s) => a + ((s.maxSlide + 1) / (s.totalSlides || 14)) * 100,
                      0
                    ) / filtered.length
                  )
                : 0}
              ٪
            </span>
          </div>
          <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50">
            <span className="block text-slate-500 font-bold">متوسط درجات الاختبار</span>
            <span className="block text-lg font-black text-indigo-700 mt-1">
              {(() => {
                const sc = filtered.filter((s) => s.quizScore != null);
                return sc.length
                  ? Math.round(
                      sc.reduce((a, s) => a + (s.quizScore! / (s.quizTotal || 8)) * 100, 0) /
                        sc.length
                    )
                  : 0;
              })()}
              ٪
            </span>
          </div>
        </div>

        {/* جدول درجات الطلاب بدون الأسئلة (كشف درجات رسمي أنيق) */}
        {!includeQuestionsInPrint ? (
          <table className="w-full text-xs text-right border-collapse mb-8">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-black">
                <th className="p-2 border text-center w-8">#</th>
                <th className="p-2 border">اسم الطالب</th>
                <th className="p-2 border text-center w-14">الفصل</th>
                <th className="p-2 border text-center w-24">الشرائح المنجزة</th>
                <th className="p-2 border text-center w-20">نسبة التقدم</th>
                <th className="p-2 border text-center w-28">درجة التقويم (من ٨)</th>
                <th className="p-2 border text-center w-24">التقدير / المستوى</th>
                <th className="p-2 border text-center w-28">تاريخ آخر نشاط</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const pct = Math.round(((s.maxSlide + 1) / (s.totalSlides || 14)) * 100);
                const grade = getGradeLevel(s.quizScore, s.quizTotal);

                return (
                  <tr key={s.id} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                    <td className="p-2 border text-center font-bold text-slate-600">{idx + 1}</td>
                    <td className="p-2 border font-extrabold text-slate-900 text-sm">{s.studentName}</td>
                    <td className="p-2 border text-center font-bold text-slate-700">
                      {s.className || "—"}
                    </td>
                    <td className="p-2 border text-center font-bold text-slate-700">
                      {s.maxSlide + 1} / {s.totalSlides || 14}
                    </td>
                    <td className="p-2 border text-center font-black text-slate-900">{pct}٪</td>
                    <td className="p-2 border text-center font-black">
                      {s.quizScore != null ? (
                        <span
                          className={
                            s.quizScore >= 6
                              ? "text-emerald-700 text-sm font-black"
                              : "text-amber-700 text-sm font-black"
                          }
                        >
                          {s.quizScore} / {s.quizTotal || 8}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">لم يُنجز</span>
                      )}
                    </td>
                    <td className={`p-2 border text-center ${grade.color}`}>{grade.text}</td>
                    <td className="p-2 border text-center text-[10px] text-slate-600">
                      {new Date(s.updatedAt).toLocaleDateString("ar-SA")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* جدول درجات وإجابات الطلاب مع الأسئلة والأنشطة */
          <table className="w-full text-xs text-right border-collapse mb-8">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-black">
                <th className="p-2 border text-center w-8">#</th>
                <th className="p-2 border">اسم الطالب</th>
                <th className="p-2 border text-center w-14">الفصل</th>
                <th className="p-2 border text-center w-24">الشرائح المنجزة</th>
                <th className="p-2 border text-center w-20">نسبة التقدم</th>
                <th className="p-2 border text-center w-24">درجة التقويم</th>
                <th className="p-2 border">ملخص إجابات الأنشطة والأسئلة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const pct = Math.round(((s.maxSlide + 1) / (s.totalSlides || 14)) * 100);
                const actsSummary = Object.entries(s.activities || {})
                  .filter(([k]) => !k.startsWith("التقويم-"))
                  .map(([k, v]) => `${k.replace("نشاط", "ن")}: ${v}`)
                  .join(" | ");

                return (
                  <tr key={s.id} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                    <td className="p-2 border text-center font-bold text-slate-600">{idx + 1}</td>
                    <td className="p-2 border font-extrabold text-slate-900">{s.studentName}</td>
                    <td className="p-2 border text-center font-bold text-slate-700">
                      {s.className || "—"}
                    </td>
                    <td className="p-2 border text-center font-bold text-slate-700">
                      {s.maxSlide + 1} / {s.totalSlides || 14}
                    </td>
                    <td className="p-2 border text-center font-black text-slate-900">{pct}٪</td>
                    <td className="p-2 border text-center font-black">
                      {s.quizScore != null ? (
                        <span className={s.quizScore >= 6 ? "text-emerald-700" : "text-amber-700"}>
                          {s.quizScore} / {s.quizTotal || 8}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">لم يُنجز</span>
                      )}
                    </td>
                    <td className="p-2 border text-[10px] text-slate-600 leading-snug">
                      {actsSummary || <span className="text-slate-400">لا توجد إجابات</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* توقيعات الاعتماد والختم */}
        <div className="pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs font-bold text-slate-700">
          <div>
            <p className="mb-7">معلم المادة</p>
            <p className="font-extrabold text-slate-900">أ. علي عبدالله راجحي</p>
          </div>
          <div>
            <p className="mb-7">الختم الرسمي</p>
            <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-full mx-auto flex items-center justify-center text-[10px] text-slate-400">
              ختم المدرسة
            </div>
          </div>
          <div>
            <p className="mb-7">مدير المدرسة</p>
            <p className="text-slate-400">....................................</p>
          </div>
        </div>
      </div>

      {/* ================= واجهة لوحة المعلم الإلكترونية ================= */}
      <div className="no-print">
        <header className="bg-teal-900 text-white shadow-lg sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-2xl">
                👨‍🏫
              </span>
              <div>
                <h1 className="font-black text-base sm:text-lg">لوحة المعلم — أ. علي عبدالله راجحي</h1>
                <p className="text-teal-200 text-[10px] sm:text-xs font-bold">
                  مدرسة العروس الابتدائية • تأسيس الدولة السعودية الثانية — الصف السادس
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-black ${
                  source === "neon" ? "bg-emerald-500" : "bg-amber-500 text-amber-950"
                }`}
              >
                {source === "neon" ? "● متصل بقاعدة Neon" : "● وضع محلي (بدون قاعدة بيانات)"}
              </span>
              <button
                onClick={onExit}
                className="rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2 font-bold text-sm"
              >
                خروج
              </button>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2">
            {(
              [
                ["students", "📊 متابعة الطلاب"],
                ["audio", "🎙️ إدارة الأصوات"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => {
                  playClick();
                  setTab(k);
                }}
                className={`rounded-xl px-4 py-2 font-extrabold text-sm transition-all ${
                  tab === k ? "bg-amber-400 text-teal-950" : "bg-white/10 hover:bg-white/20"
                }`}
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
                  <div
                    key={i}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm"
                  >
                    <span className="text-2xl">{ic as string}</span>
                    <p className="text-3xl font-black text-teal-800 mt-1">{val as string}</p>
                    <p className="font-bold text-slate-500 text-sm">{label as string}</p>
                  </div>
                ))}
              </div>

              {/* شريط الإجراءات والبحث */}
              <div className="flex flex-wrap gap-2 mb-4">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="🔍 ابحث باسم الطالب أو الفصل (٦/١ أو ٦/٢)…"
                  className="flex-1 min-w-48 rounded-xl border-2 border-slate-300 px-4 py-2.5 font-bold focus:border-teal-500 focus:outline-none"
                />
                <button
                  onClick={() => void load()}
                  className="rounded-xl bg-teal-700 text-white font-bold px-4 py-2.5 hover:bg-teal-800"
                >
                  {loading ? "⏳ تحديث…" : "🔄 تحديث"}
                </button>
                <button
                  onClick={() => handlePrint(false)}
                  className="rounded-xl bg-indigo-600 text-white font-bold px-4 py-2.5 hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm transition-all hover:scale-105"
                  title="طباعة كشف الدرجات والإنجاز بدون الأسئلة (رسمي وموجز)"
                >
                  <span>🖨️</span>
                  <span>طباعة التقرير (بدون الأسئلة)</span>
                </button>
                <button
                  onClick={() => handlePrint(true)}
                  className="rounded-xl bg-white border-2 border-indigo-300 text-indigo-800 font-bold px-3.5 py-2.5 hover:bg-indigo-50 flex items-center gap-1.5 transition-all"
                  title="طباعة التقرير المفصل مع إجابات الأسئلة والأنشطة"
                >
                  <span>📄</span>
                  <span>طباعة مع الأسئلة</span>
                </button>
                <button
                  onClick={exportCSV}
                  className="rounded-xl bg-emerald-600 text-white font-bold px-4 py-2.5 hover:bg-emerald-700 flex items-center gap-1.5"
                  title="تصدير جدول Excel/CSV"
                >
                  <span>📥</span>
                  <span>تصدير Excel</span>
                </button>
                <button
                  onClick={async () => {
                    if (confirm("تحذير: هل أنت متأكد من حذف جميع سجلات الطلاب نهائياً؟")) {
                      await deleteAllRemote();
                      void load();
                    }
                  }}
                  className="rounded-xl bg-rose-100 text-rose-700 font-bold px-4 py-2.5 hover:bg-rose-200"
                  title="مسح كل السجلات"
                >
                  🗑️ مسح الكل
                </button>
              </div>

              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
                  <span className="text-5xl">📭</span>
                  <p className="font-extrabold text-slate-500 mt-3">
                    لا توجد سجلات بعد — اطلب من الطلاب بدء الدرس بأسمائهم.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((s) => {
                    const pct = Math.round(((s.maxSlide + 1) / (s.totalSlides || 14)) * 100);
                    const isOpen = open === s.id;
                    return (
                      <div
                        key={s.id}
                        className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden"
                      >
                        <div className="w-full p-4 flex flex-wrap items-center gap-3 sm:gap-4 text-right">
                          <button
                            onClick={() => setOpen(isOpen ? null : s.id)}
                            className="flex items-center gap-3 sm:gap-4 flex-1 min-w-40 text-right cursor-pointer"
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-black">
                              {s.studentName.charAt(0)}
                            </span>
                            <div className="flex-1 min-w-36">
                              <p className="font-extrabold text-slate-800 text-base">
                                {s.studentName}
                              </p>
                              <p className="text-slate-500 font-bold text-xs mt-0.5">
                                الفصل:{" "}
                                <span className="font-extrabold text-teal-700">
                                  {s.className || "—"}
                                </span>{" "}
                                • آخر نشاط: {new Date(s.updatedAt).toLocaleTimeString("ar-SA")}
                              </p>
                            </div>
                          </button>

                          {/* شريط التقدم */}
                          <div className="w-full sm:w-36 order-last sm:order-none">
                            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-l from-teal-500 to-teal-700"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-xs font-black text-slate-500 mt-1">
                              {pct}٪ — شريحة {s.maxSlide + 1}/{s.totalSlides}
                            </p>
                          </div>

                          {/* درجة الاختبار */}
                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-black ${
                              s.quizScore != null
                                ? s.quizScore / (s.quizTotal || 8) >= 0.7
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {s.quizScore != null
                              ? `الاختبار: ${s.quizScore}/${s.quizTotal ?? 8}`
                              : "لم يُنجز الاختبار"}
                          </span>

                          {/* زر حذف الطالب المستقل */}
                          <button
                            onClick={() => handleDeleteStudent(s.id, s.studentName)}
                            className="rounded-xl p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition-colors"
                            title={`حذف بيانات الطالب ${s.studentName} نهائياً`}
                          >
                            🗑️
                          </button>

                          {/* سهم التوسيع */}
                          <button
                            onClick={() => setOpen(isOpen ? null : s.id)}
                            className="text-slate-400 p-1 hover:text-slate-600"
                            title={isOpen ? "طي التفاصيل" : "عرض التفاصيل"}
                          >
                            {isOpen ? "▲" : "▼"}
                          </button>
                        </div>

                        {/* التفاصيل وإجابات الأنشطة */}
                        {isOpen && (
                          <div className="border-t-2 border-slate-100 p-4 bg-slate-50 animate-slidein">
                            <h4 className="font-extrabold text-teal-800 mb-3 flex items-center justify-between">
                              <span>📝 إجابات الأنشطة المكتوبة</span>
                              <span className="text-xs text-slate-400 font-bold">
                                معرّف: {s.id.slice(0, 8)}
                              </span>
                            </h4>
                            {Object.keys(s.activities || {}).length === 0 ? (
                              <p className="text-slate-500 font-bold text-sm">
                                لم يُسجل الطالب أي إجابة كتابية بعد.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {Object.entries(s.activities).map(([k, v]) => (
                                  <div
                                    key={k}
                                    className="bg-white rounded-xl border border-slate-200 p-3"
                                  >
                                    <p className="font-extrabold text-rose-700 text-sm mb-1">{k}</p>
                                    <p className="font-semibold text-slate-700 text-sm whitespace-pre-wrap">
                                      {typeof v === "object"
                                        ? JSON.stringify(v, null, 1)
                                        : String(v) || "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* زر الحذف داخل البطاقة الموسعة للتأكيد */}
                            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center flex-wrap gap-2">
                              <span className="text-xs text-slate-400 font-bold">
                                بدأ الدرس: {new Date(s.startedAt).toLocaleString("ar-SA")}
                              </span>
                              <button
                                onClick={() => handleDeleteStudent(s.id, s.studentName)}
                                className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-3 py-1.5 text-xs font-black transition-colors flex items-center gap-1.5"
                              >
                                <span>🗑️</span>
                                <span>حذف سجل هذا الطالب</span>
                              </button>
                            </div>
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
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchStudents, deleteAllRemote, deleteStudent, renameStudent, toCSV,
  makeBackup, parseBackup, localOnlyStudents, restoreMissingStudents,
  type StudentProgress,
} from "../lib/progress";
import { CLASSES } from "../lib/classes";
import { PrintReport } from "./PrintReport";
import { AudioManager } from "./AudioManager";
import { playClick } from "../utils/audio";

const TEACHER_PIN = "139613";

export function TeacherDashboard({ onExit }: { onExit: () => void }) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [tab, setTab] = useState<"students" | "audio">("students");
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [source, setSource] = useState<"neon" | "local">("local");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("");
  const [includeActivities, setIncludeActivities] = useState(true);
  const [includeQuiz, setIncludeQuiz] = useState(true);
  const [printOpts, setPrintOpts] = useState({ activities: true, quiz: true });
  const [printList, setPrintList] = useState<StudentProgress[] | null>(null);
  const [printTitle, setPrintTitle] = useState("تقرير متابعة الطلاب");
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const loadVersion = useRef(0);

  const load = async () => {
    const version = loadVersion.current;
    setLoading(true);
    const r = await fetchStudents();
    if (version === loadVersion.current) {
      setStudents(r.students);
      setSource(r.source);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authed) return;
    void load();
    const t = setInterval(() => void load(), 15000); // تحديث تلقائي كل ١٥ ثانية
    return () => clearInterval(t);
  }, [authed]);

  const filtered = useMemo(
    () =>
      students.filter(
        (s) => (s.studentName + s.className).includes(filter.trim()) && (!classFilter || s.className === classFilter)
      ),
    [students, filter, classFilter]
  );

  const localOnlyCount = useMemo(() => source === "neon" ? localOnlyStudents(students).length : 0, [students, source]);

  const downloadBackup = () => {
    const file = new Blob([makeBackup(students)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `نسخة-احتياطية-الطلاب-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const restore = async (records: StudentProgress[]) => {
    if (source !== "neon") {
      setNotice({ type: "err", text: "اربط قاعدة Neon أولاً حتى تُحفظ السجلات بعد النشر." });
      return;
    }
    const existing = new Set(students.map((student) => student.id));
    const missing = records.filter((student) => !existing.has(student.id)).length;
    if (!missing) {
      setNotice({ type: "ok", text: "جميع سجلات هذه النسخة محفوظة مسبقاً، ولم يُستبدل أي سجل." });
      return;
    }
    if (!confirm(`إضافة ${missing} سجل طالب غير موجود إلى Neon؟\nلن تُحذف السجلات الحالية أو تُستبدل إجاباتها.`)) return;
    setBackupBusy(true);
    try {
      const result = await restoreMissingStudents(records, students.map((student) => student.id));
      loadVersion.current++;
      await load();
      setNotice({
        type: result.failed ? "err" : "ok",
        text: `نُقل ${result.restored} سجل إلى Neon${result.skipped ? `، وتُرك ${result.skipped} سجل موجود دون تغيير` : ""}${result.failed ? `، وتعذر نقل ${result.failed} سجل. أعد المحاولة.` : "."}`,
      });
    } finally {
      setBackupBusy(false);
    }
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("حجم النسخة الاحتياطية أكبر من ٥ ميجابايت");
      await restore(parseBackup(await file.text()));
    } catch (error) {
      setNotice({ type: "err", text: error instanceof Error ? error.message : "تعذر قراءة النسخة الاحتياطية" });
    }
  };

  /* ===== الطباعة / PDF ===== */
  const startPrint = (
    list: StudentProgress[],
    title: string,
    opts?: { activities?: boolean; quiz?: boolean }
  ) => {
    setPrintOpts({
      activities: opts?.activities ?? includeActivities,
      quiz: opts?.quiz ?? includeQuiz,
    });
    setPrintTitle(title);
    setPrintList([...list]);
  };

  useEffect(() => {
    if (!printList) return;
    const oldTitle = document.title;
    document.title = printTitle; // يصبح اسم ملف PDF الافتراضي
    const t = setTimeout(() => window.print(), 350);
    const after = () => {
      document.title = oldTitle;
      setPrintList(null);
    };
    window.addEventListener("afterprint", after);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", after);
      document.title = oldTitle;
    };
  }, [printList, printTitle]);

  /* ===== حذف طالب ===== */
  const removeStudent = async (st: StudentProgress) => {
    if (!confirm(`هل تريد حذف الطالب «${st.studentName}» وجميع إجاباته نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    const ok = await deleteStudent(st.id);
    loadVersion.current++;
    setStudents((arr) => arr.filter((x) => x.id !== st.id));
    if (open === st.id) setOpen(null);
    if (editingId === st.id) setEditingId(null);
    setNotice(
      ok
        ? { type: "ok", text: `تم حذف الطالب «${st.studentName}» بنجاح ✅` }
        : { type: "err", text: `حُذف «${st.studentName}» محلياً فقط — تعذّر الوصول إلى قاعدة البيانات.` }
    );
    setTimeout(() => setNotice(null), 4000);
  };

  const saveName = async (event: React.FormEvent<HTMLFormElement>, student: StudentProgress) => {
    event.preventDefault();
    const name = nameDraft.replace(/\s+/g, " ").trim();
    if (name.length < 3 || name.length > 100) {
      setEditError("اكتب اسماً صحيحاً من ٣ إلى ١٠٠ حرف");
      return;
    }
    if (name === student.studentName) { setEditingId(null); return; }
    setSavingName(true);
    setEditError("");
    try {
      const savedName = await renameStudent(student.id, name);
      loadVersion.current++;
      setStudents((rows) => rows.map((row) => row.id === student.id ? { ...row, studentName: savedName } : row));
      setEditingId(null);
      setNotice({ type: "ok", text: `حُفظ اسم الطالب «${savedName}» دون تغيير فصله أو تقدمه أو إجاباته.` });
      void load();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "تعذر حفظ الاسم. حاول مرة أخرى.");
    } finally {
      setSavingName(false);
    }
  };

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
    const submitPin = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const valid = pin === TEACHER_PIN;
      setAuthed(valid);
      setPinError(!valid);
    };

    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-teal-950 to-rose-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-slidein">
          <div className="text-center mb-6">
            <span className="text-4xl">👨‍🏫</span>
            <h2 className="text-2xl font-black text-teal-900 mt-2">لوحة المعلم</h2>
            <p className="text-slate-500 font-bold text-sm">أدخل رمز الدخول</p>
          </div>
          <form onSubmit={submitPin}>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              aria-label="رمز دخول المعلم"
              aria-invalid={pinError}
              value={pin}
              onChange={(e) => { setPin(e.target.value); setPinError(false); }}
              className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-center text-2xl font-black tracking-widest focus:border-teal-500 focus:outline-none mb-4"
            />
            {pinError && <p role="alert" className="text-rose-600 font-bold text-sm mb-3 text-center">الرمز غير صحيح</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-teal-700 text-white font-black py-3 hover:bg-teal-800 transition-colors mb-3"
            >
              دخول
            </button>
          </form>
          <button onClick={onExit} className="w-full rounded-xl bg-slate-100 text-slate-600 font-bold py-2.5 hover:bg-slate-200">
            → رجوع
          </button>
        </div>
      </div>
    );
  }

  /* ===== اللوحة ===== */
  return (
    <>
    <div dir="rtl" className="min-h-screen bg-slate-50 print:hidden">
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

            {!loading && source === "local" && (
              <p className="text-sm font-bold text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4">
                لا يوجد اتصال بقاعدة Neon حالياً. إن كانت هناك سجلات سابقة فتأكد من متغير DATABASE_URL لبيئة Production قبل إدخال بيانات جديدة.
              </p>
            )}

            <details className="bg-white rounded-xl border border-slate-200 mb-4">
              <summary className="cursor-pointer px-4 py-3 font-extrabold text-teal-800">
                النسخ الاحتياطي وحفظ بيانات الطلاب{localOnlyCount > 0 ? ` (${localOnlyCount} سجل على هذا الجهاز لم يُرفع)` : ""}
              </summary>
              <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                <p className="text-sm font-semibold text-slate-600 leading-relaxed">
                  تبقى سجلات الطلاب وأسماؤهم ودرجاتهم في Neon بعد إعادة نشر الموقع عند استخدام رابط قاعدة البيانات نفسه.
                  نزّل نسخة احتياطية قبل تغيير مشروع Vercel أو قاعدة Neon.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={downloadBackup} className="rounded-lg bg-teal-700 text-white px-4 py-2 font-bold text-sm hover:bg-teal-800">
                    تنزيل نسخة احتياطية JSON
                  </button>
                  {source === "neon" && (
                    <label className={`rounded-lg bg-indigo-600 text-white px-4 py-2 font-bold text-sm ${backupBusy ? "opacity-50" : "cursor-pointer hover:bg-indigo-700"}`}>
                      استعادة بيانات من نسخة احتياطية
                      <input
                        type="file"
                        accept=".json,application/json"
                        disabled={backupBusy}
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          void importBackup(file);
                        }}
                      />
                    </label>
                  )}
                  {source === "neon" && localOnlyCount > 0 && (
                    <button
                      disabled={backupBusy}
                      onClick={() => void restore(localOnlyStudents(students))}
                      className="rounded-lg bg-amber-100 text-amber-900 px-4 py-2 font-bold text-sm hover:bg-amber-200 disabled:opacity-50"
                    >
                      نقل {localOnlyCount} سجل سابق من هذا الجهاز إلى Neon
                    </button>
                  )}
                </div>
                {source === "local" && <p className="text-xs font-bold text-amber-800">الاستعادة تتطلب ربط Neon. يمكن تنزيل النسخة الآن ثم استعادتها بعد الربط.</p>}
              </div>
            </details>

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
                onClick={() =>
                  startPrint(
                    filtered,
                    classFilter ? `تقرير متابعة طلاب الفصل ${classFilter}` : "تقرير متابعة الطلاب"
                  )
                }
                disabled={filtered.length === 0}
                className="rounded-xl bg-indigo-600 text-white font-bold px-4 py-2.5 hover:bg-indigo-700 disabled:opacity-40"
              >
                🖨️ طباعة التقرير PDF
              </button>
              <button
                onClick={() =>
                  startPrint(
                    filtered,
                    classFilter ? `تقرير طلاب الفصل ${classFilter} (بدون الأسئلة)` : "تقرير متابعة الطلاب (بدون الأسئلة)",
                    { quiz: false }
                  )
                }
                disabled={filtered.length === 0}
                title="تقرير مختصر بدون إجابات أسئلة التقويم"
                className="rounded-xl bg-violet-600 text-white font-bold px-4 py-2.5 hover:bg-violet-700 disabled:opacity-40"
              >
                📄 طباعة بدون الأسئلة
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

            {/* مرشح الفصل + خيارات محتوى التقرير */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="font-extrabold text-slate-500 text-sm">الفصل:</span>
              {["", ...CLASSES].map((c) => (
                <button
                  key={c || "all"}
                  onClick={() => setClassFilter(c)}
                  className={`rounded-full px-4 py-1.5 text-sm font-extrabold border-2 transition-all ${
                    classFilter === c ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-slate-300 text-slate-600 hover:border-teal-400"
                  }`}
                >
                  {c ? <bdi dir="ltr">{c}</bdi> : "الكل"}
                </button>
              ))}
              <div className="mr-auto flex flex-wrap items-center gap-x-4 gap-y-1">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeActivities}
                    onChange={(e) => setIncludeActivities(e.target.checked)}
                    className="h-4 w-4 accent-teal-700"
                  />
                  إجابات الأنشطة
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeQuiz}
                    onChange={(e) => setIncludeQuiz(e.target.checked)}
                    className="h-4 w-4 accent-teal-700"
                  />
                  أسئلة التقويم وإجاباتها
                </label>
              </div>
            </div>

            {notice && (
              <div
                className={`rounded-xl p-3 font-bold text-sm border-2 mb-4 animate-slidein ${
                  notice.type === "ok" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-amber-50 border-amber-300 text-amber-900"
                }`}
              >
                {notice.text}
              </div>
            )}

            {loading && students.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center font-bold text-slate-600">
                جارٍ تحميل سجلات الطلاب...
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
                <span className="text-5xl">📭</span>
                <p className="font-extrabold text-slate-500 mt-3">
                  {filter || classFilter
                    ? "لا توجد سجلات مطابقة للبحث أو الفصل المحدد."
                    : source === "neon"
                      ? "لا توجد سجلات في قاعدة Neon المتصلة حالياً. تحقق من قاعدة إنتاجك السابقة أو استعد نسخة احتياطية، ولا تنشئ قاعدة جديدة قبل التأكد."
                      : "لا توجد سجلات محلية على هذا الجهاز. تحقق من اتصال Neon لرؤية بيانات الطلاب السابقة."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((s) => {
                  const pct = Math.round(((s.maxSlide + 1) / (s.totalSlides || 14)) * 100);
                  const isOpen = open === s.id;
                  return (
                    <div key={s.id} className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-3 sm:p-4 flex flex-wrap items-center gap-3 sm:gap-4">
                        <button
                          onClick={() => setOpen(isOpen ? null : s.id)}
                          className="flex flex-1 min-w-52 flex-wrap items-center gap-3 sm:gap-4 text-right rounded-xl hover:bg-slate-50 -m-1 p-1"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-black">
                            {s.studentName.charAt(0)}
                          </span>
                          <div className="flex-1 min-w-36">
                            <p className="font-extrabold text-slate-800">{s.studentName}</p>
                            <p className="text-slate-500 font-bold text-xs">
                              الفصل <bdi dir="ltr">{s.className || "—"}</bdi> • آخر نشاط: {new Date(s.updatedAt).toLocaleString("ar-SA")}
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
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0">
                          <button
                            onClick={() => {
                              setEditingId(s.id);
                              setNameDraft(s.studentName);
                              setEditError("");
                            }}
                            disabled={source !== "neon"}
                            title={source === "neon" ? "تعديل اسم الطالب" : "يتطلب اتصال قاعدة بيانات Neon"}
                            className="rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-800 px-3 py-2 text-sm font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            تعديل الاسم
                          </button>
                          <button
                            onClick={() => startPrint([s], `تقرير الطالب ${s.studentName}`)}
                            title="طباعة تقرير هذا الطالب PDF"
                            className="rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-2 text-sm font-extrabold"
                          >
                            🖨️ <span className="hidden sm:inline">تقرير</span>
                          </button>
                          <button
                            onClick={() => startPrint([s], `تقرير الطالب ${s.studentName} (بدون الأسئلة)`, { quiz: false })}
                            title="طباعة تقرير هذا الطالب بدون أسئلة التقويم"
                            className="rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 px-3 py-2 text-sm font-extrabold"
                          >
                            📄 <span className="hidden md:inline">بدون الأسئلة</span>
                          </button>
                          <button
                            onClick={() => void removeStudent(s)}
                            title="حذف هذا الطالب"
                            className="rounded-lg bg-rose-100 hover:bg-rose-600 hover:text-white text-rose-700 px-3 py-2 text-sm font-extrabold transition-colors"
                          >
                            🗑️ <span className="hidden sm:inline">حذف</span>
                          </button>
                        </div>
                      </div>
                      {editingId === s.id && (
                        <form onSubmit={(event) => void saveName(event, s)} className="border-t border-teal-200 bg-teal-50 p-4 flex flex-wrap items-end gap-3">
                          <label className="flex-1 min-w-48 font-extrabold text-teal-900 text-sm">
                            الاسم الجديد للطالب
                            <input
                              autoFocus
                              maxLength={100}
                              value={nameDraft}
                              onChange={(event) => { setNameDraft(event.target.value); setEditError(""); }}
                              className="block w-full mt-1 rounded-lg border-2 border-teal-300 bg-white px-3 py-2.5 font-bold focus:border-teal-600 focus:outline-none"
                            />
                          </label>
                          <button type="submit" disabled={savingName} className="rounded-lg bg-teal-700 text-white px-5 py-2.5 font-extrabold disabled:opacity-50">
                            {savingName ? "جارٍ الحفظ..." : "حفظ الاسم"}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} disabled={savingName} className="rounded-lg bg-white border border-slate-300 text-slate-700 px-4 py-2.5 font-bold disabled:opacity-50">
                            إلغاء
                          </button>
                          {editError && <p role="alert" className="w-full text-sm font-bold text-rose-700">{editError}</p>}
                        </form>
                      )}
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
    {printList && (
      <PrintReport
        students={printList}
        title={printTitle}
        includeActivities={printOpts.activities}
        includeQuiz={printOpts.quiz}
      />
    )}
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  fetchStudents,
  deleteAllRemote,
  deleteStudent,
  renameStudent,
  readLocal,
  toCSV,
  type StudentProgress,
} from "../lib/progress";
import { PrintReport } from "./PrintReport";
import { AudioManager } from "./AudioManager";
import { playClick } from "../utils/audio";

const TEACHER_PIN = "139613";

export function TeacherDashboard({ onExit }: { onExit: () => void }) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<"students" | "audio">("students");
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [source, setSource] = useState<"neon" | "local">("local");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("");
  const [includeActivities, setIncludeActivities] = useState(true);
  const [includeQuiz, setIncludeQuiz] = useState(true);
  const [printOpts, setPrintOpts] = useState({ activities: true, quiz: true });
  const [printList, setPrintList] = useState<StudentProgress[] | null>(null);
  const [printTitle, setPrintTitle] = useState("تقرير متابعة الطلاب");
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; cls: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [classEdit, setClassEdit] = useState<{ id: string; name: string; cls: string } | null>(null);
  const [recovery, setRecovery] = useState<StudentProgress[] | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [diag, setDiag] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [bulkNames, setBulkNames] = useState<Record<string, string>>({});
  const [bulkClasses, setBulkClasses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetchStudents();
    setStudents(r.students);
    setSource(r.source);
    setLoading(false);
    // تشخيص: سبب عدم الاتصال بقاعدة البيانات
    if (r.source === "local") {
      try {
        const res = await fetch("/api/progress");
        const body = await res.json().catch(() => null);
        setConnError(
          body?.error
            ? `تعذّر الاتصال بقاعدة البيانات: ${body.error}`
            : res.ok
            ? null
            : `استجابة غير متوقعة من الخادم (${res.status})`
        );
      } catch (e: any) {
        setConnError(`تعذّر الوصول لدوال الخادم (/api/progress): ${e?.message || "غير معروف"}`);
      }
    } else {
      setConnError(null);
    }
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

  const classes = useMemo(
    () => Array.from(new Set(students.map((s) => s.className).filter(Boolean))).sort(),
    [students]
  );

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
  /* ===== تعديل اسم الطالب مع الحفاظ على بياناته ===== */
  const saveRename = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (name.length < 3) {
      setNotice({ type: "err", text: "اكتب اسم الطالب الثلاثي بشكل صحيح (٣ أحرف على الأقل)." });
      return;
    }
    setSaving(true);
    const r = await renameStudent(editing.id, name, editing.cls);
    setStudents((arr) =>
      arr.map((s) =>
        s.id === editing.id
          ? { ...s, studentName: name, className: editing.cls || s.className, updatedAt: new Date().toISOString() }
          : s
      )
    );
    setEditing(null);
    setSaving(false);
    setNotice(
      r.synced
        ? { type: "ok", text: `تم تعديل الاسم إلى «${name}» بنجاح مع الاحتفاظ بجميع بياناته السابقة ✅` }
        : { type: "ok", text: `تم تعديل الاسم محلياً إلى «${name}». لم يُحفظ في قاعدة البيانات (لا يوجد اتصال).` }
    );
    setTimeout(() => setNotice(null), 4500);
  };

  /* ===== تعديل فصل الطالب فقط (مع الاحتفاظ بالاسم والبيانات) ===== */
  const saveClass = async () => {
    if (!classEdit) return;
    const target = students.find((x) => x.id === classEdit.id);
    if (!target) return;
    const r = await renameStudent(classEdit.id, target.studentName, classEdit.cls);
    setStudents((arr) =>
      arr.map((s) =>
        s.id === classEdit.id
          ? { ...s, className: classEdit.cls, updatedAt: new Date().toISOString() }
          : s
      )
    );
    setClassEdit(null);
    setNotice({
      type: "ok",
      text: r.synced
        ? `تم نقل «${target.studentName}» إلى فصل ${classEdit.cls} بنجاح ✅`
        : `تم نقل «${target.studentName}» إلى فصل ${classEdit.cls} (محلياً فقط — لا يوجد اتصال بقاعدة البيانات).`,
    });
    setTimeout(() => setNotice(null), 4500);
  };

  /* ===== عرض كل السجلات المحفوظة في قاعدة البيانات ============= */
  const loadAllRecords = async () => {
    setRecovering(true);
    try {
      const res = await fetch("/api/progress");
      const data = await res.json();
      const list: StudentProgress[] = (data.students || []).map((r: any) => ({
        id: r.id,
        studentName: r.student_name,
        className: r.class_name || "",
        maxSlide: r.max_slide ?? 0,
        totalSlides: r.total_slides ?? 14,
        quizScore: r.quiz_score,
        quizTotal: r.quiz_total,
        activities: r.activities || {},
        startedAt: r.started_at,
        updatedAt: r.updated_at,
      }));
      setRecovery(list);
    } catch {
      const local = readLocal() as StudentProgress[];
      setRecovery(local.sort((a: StudentProgress, b: StudentProgress) => (a.updatedAt < b.updatedAt ? 1 : -1)));
    }
    setRecovering(false);
  };

  /* ===== تشخيص قاعدة البيانات ===== */
  const runDiagnose = async () => {
    setDiagLoading(true);
    setDiag(null);
    try {
      const res = await fetch("/api/progress?diagnose=1");
      const body = await res.json();
      setDiag(body);
    } catch (e: any) {
      setDiag({ queryOk: false, error: e?.message || "تعذّر الوصول لدالة الخادم" });
    }
    setDiagLoading(false);
  };

  const removeStudent = async (st: StudentProgress) => {
    if (!confirm(`هل تريد حذف الطالب «${st.studentName}» وجميع إجاباته نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    const ok = await deleteStudent(st.id);
    setStudents((arr) => arr.filter((x) => x.id !== st.id));
    if (open === st.id) setOpen(null);
    setNotice(
      ok
        ? { type: "ok", text: `تم حذف الطالب «${st.studentName}» بنجاح ✅` }
        : { type: "err", text: `حُذف «${st.studentName}» محلياً فقط — تعذّر الوصول إلى قاعدة البيانات.` }
    );
    setTimeout(() => setNotice(null), 4000);
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
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-teal-950 to-rose-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-slidein">
          <div className="text-center mb-6">
            <span className="text-4xl">👨‍🏫</span>
            <h2 className="text-2xl font-black text-teal-900 mt-2">لوحة المعلم</h2>
            <p className="text-slate-500 font-bold text-sm">أدخل رمز الدخول</p>
          </div>
          <div className="flex items-center gap-2 mb-5 bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-2.5">
            <span className="text-lg">🔑</span>
            <span className="font-extrabold text-amber-900 text-sm">رمز الدخول: 139613</span>
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
            <p className="text-rose-600 font-bold text-sm mb-3 text-center">تعذّر الدخول — تأكد من الرمز المدخل</p>
          )}
          <button
            onClick={() => setAuthed(pin === TEACHER_PIN)}
            className="w-full rounded-xl bg-teal-700 text-white font-black py-3 hover:bg-teal-800 transition-colors mb-3"
          >
            دخول
          </button>
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
              <button
                onClick={() => void runDiagnose()}
                title="تشخيص الاتصال بقاعدة البيانات"
                className="rounded-xl bg-indigo-600 text-white font-bold px-4 py-2.5 hover:bg-indigo-700"
              >
                {diagLoading ? "⏳ جارٍ الفحص…" : "🔬 تشخيص القاعدة"}
              </button>
              <button
                onClick={() => void loadAllRecords()}
                title="عرض كل السجلات المحفوظة في قاعدة البيانات"
                className="rounded-xl bg-slate-700 text-white font-bold px-4 py-2.5 hover:bg-slate-800"
              >
                {recovering ? "⏳ جارٍ…" : "♻️ استرجاع السجلات"}
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
              {["", ...classes].map((c) => (
                <button
                  key={c || "all"}
                  onClick={() => setClassFilter(c)}
                  className={`rounded-full px-4 py-1.5 text-sm font-extrabold border-2 transition-all ${
                    classFilter === c ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-slate-300 text-slate-600 hover:border-teal-400"
                  }`}
                >
                  {c || "الكل"}
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

            {diag && (
              <div className="rounded-xl p-4 border-2 border-indigo-300 bg-indigo-50 mb-4 animate-slidein">
                <p className="font-black text-indigo-900 mb-2">🔬 نتيجة تشخيص قاعدة البيانات</p>
                <div className="grid sm:grid-cols-2 gap-2 text-xs font-bold">
                  <div className="bg-white rounded-lg p-2 border border-indigo-100">
                    <span className="text-slate-500">رابط الاتصال: </span>
                    <span className={diag.hasUrl ? "text-emerald-700" : "text-rose-700"}>
                      {diag.hasUrl ? "✅ موجود" : "❌ غير موجود"}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-indigo-100">
                    <span className="text-slate-500">الاستعلام: </span>
                    <span className={diag.queryOk ? "text-emerald-700" : "text-rose-700"}>
                      {diag.queryOk ? `✅ نجح (${diag.ms}ms)` : "❌ فشل"}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-indigo-100">
                    <span className="text-slate-500">عدد سجلات الطلاب: </span>
                    <span className="text-teal-700">{diag.count ?? "—"}</span>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-indigo-100">
                    <span className="text-slate-500">سجلات الأسماء المعدّلة: </span>
                    <span className="text-teal-700">{diag.teacherNames ?? "—"}</span>
                  </div>
                </div>
                {diag.error && (
                  <p className="mt-2 text-rose-700 font-black text-xs break-words bg-white rounded-lg p-2 border border-rose-200">
                    {diag.error}
                  </p>
                )}
                {diag.varsFound && (
                  <div className="mt-2 bg-white rounded-lg p-2 border border-indigo-100">
                    <p className="font-black text-slate-600 text-[11px] mb-1">المتغيرات البيئية الموجودة في Vercel:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(diag.varsFound).map(([k, v]: any) => (
                        <span
                          key={k}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            v ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400 line-through"
                          }`}
                        >
                          {k} {v ? "✅" : "❌"}
                        </span>
                      ))}
                    </div>
                    <p className="font-bold text-slate-500 text-[10px] mt-2 leading-relaxed">
                      يحتاج النظام واحداً فقط منها. جرّب أولاً <code className="bg-slate-100 px-1 rounded">DATABASE_URL_UNPOOLED</code>{" "}
                      ثم <code className="bg-slate-100 px-1 rounded">DATABASE_URL</code> — انسخه من Neon ← Connection Details ← Connection string.
                    </p>
                  </div>
                )}
                {diag.byClass && diag.byClass.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {diag.byClass.map((c: any) => (
                      <span key={c.class_name} className="bg-white border border-indigo-200 rounded-full px-3 py-1 font-black text-[11px] text-indigo-800">
                        {c.class_name || "بدون فصل"}: {c.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {connError && (
              <div className="rounded-xl p-4 border-2 border-amber-400 bg-amber-50 mb-4 animate-slidein">
                <p className="font-black text-amber-900 mb-1">⚠️ لا يوجد اتصال بقاعدة البيانات</p>
                <p className="font-bold text-amber-800 text-xs leading-relaxed mb-2">{connError}</p>
                <p className="font-bold text-amber-800 text-xs leading-relaxed">
                  الحل: في Vercel ← Settings ← Environment Variables ← أضف{" "}
                  <code className="bg-amber-100 px-1 rounded">DATABASE_URL</code> (رابط Neon) ← ثم أعد النشر.
                  البيانات المحفوظة على هذا الجهاز ما زالت تعمل بـ«وضع محلي».
                </p>
              </div>
            )}

            {notice && (
              <div
                className={`rounded-xl p-3 font-bold text-sm border-2 mb-4 animate-slidein ${
                  notice.type === "ok" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-amber-50 border-amber-300 text-amber-900"
                }`}
              >
                {notice.text}
              </div>
            )}

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
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setEditing({ id: s.id, name: s.studentName, cls: s.className || "٦/١" })}
                            title="تعديل اسم الطالب"
                            className="rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-2 text-sm font-extrabold"
                          >
                            ✏️ <span className="hidden sm:inline">تعديل الاسم</span>
                          </button>
                          <button
                            onClick={() => setClassEdit({ id: s.id, name: s.studentName, cls: s.className || "٦/١" })}
                            title="تعديل فصل الطالب"
                            className="rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 px-3 py-2 text-sm font-extrabold"
                          >
                            🏫 <span className="hidden lg:inline">تغيير الفصل</span>
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
    {recovery && (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur flex items-center justify-center p-4 print:hidden">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-6 animate-slidein max-h-[88vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black text-teal-900 flex items-center gap-2">♻️ كل السجلات المحفوظة في قاعدة البيانات</h3>
            <button onClick={() => setRecovery(null)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none">
              ×
            </button>
          </div>
          <p className="text-slate-500 font-bold text-sm mb-4">
            {recovery.length} سجل — هذه بيانات الطلاب المحفوظة فعلياً في Neon. يمكنك تعديل الأسماء والفصول من هنا مباشرة.
          </p>
          <div className="overflow-y-auto flex-1 border-2 border-slate-200 rounded-xl mb-4">
            <table className="w-full text-sm">
              <thead className="bg-teal-800 text-white sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-right font-extrabold">اسم الطالب</th>
                  <th className="px-2 py-2 text-right font-extrabold">الفصل</th>
                  <th className="px-2 py-2 text-right font-extrabold">التقدم</th>
                  <th className="px-2 py-2 text-right font-extrabold">الدرجة</th>
                  <th className="px-2 py-2 text-right font-extrabold">إجابات</th>
                  <th className="px-2 py-2 text-right font-extrabold">آخر نشاط</th>
                </tr>
              </thead>
              <tbody>
                {recovery.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 even:bg-slate-50">
                    <td className="px-2 py-1.5 font-extrabold">{r.studentName}</td>
                    <td className="px-2 py-1.5 font-bold">{r.className || "—"}</td>
                    <td className="px-2 py-1.5 font-bold">{r.maxSlide + 1}/{r.totalSlides}</td>
                    <td className="px-2 py-1.5 font-bold">{r.quizScore != null ? `${r.quizScore}/${r.quizTotal ?? 8}` : "—"}</td>
                    <td className="px-2 py-1.5 font-bold">{Object.keys(r.activities || {}).length}</td>
                    <td className="px-2 py-1.5 text-xs text-slate-500 font-bold">
                      {new Date(r.updatedAt).toLocaleString("ar-SA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRecovery(null);
                void load();
              }}
              className="flex-1 rounded-xl bg-teal-700 text-white font-black py-3 hover:bg-teal-800 transition-colors"
            >
              ✅ اعتماد هذه السجلات في اللوحة
            </button>
            <button onClick={() => setRecovery(null)} className="rounded-xl bg-slate-100 text-slate-600 font-bold px-5 py-3 hover:bg-slate-200">
              إغلاق
            </button>
          </div>
        </div>
      </div>
    )}
    {bulkOpen && (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur flex items-center justify-center p-4 print:hidden">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 animate-slidein max-h-[88vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black text-teal-900 flex items-center gap-2">📝 تعديل أسماء الطلاب وفصولهم (دفعة واحدة)</h3>
            <button onClick={() => setBulkOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none">
              ×
            </button>
          </div>
          <p className="text-slate-500 font-bold text-sm mb-4">
            عدّل الأسماء والفصول هنا ثم اضغط «حفظ الكل». لن تتأثر درجات الطلاب ولا إجاباتهم ولا تقدمهم.
          </p>
          <div className="overflow-y-auto flex-1 space-y-2 mb-4" dir="rtl">
            {filtered.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-24 shrink-0 font-extrabold text-slate-500 text-xs truncate">{s.studentName}</span>
                <input
                  value={bulkNames[s.id] ?? s.studentName}
                  onChange={(e) => setBulkNames((b) => ({ ...b, [s.id]: e.target.value }))}
                  className="flex-1 rounded-lg border-2 border-slate-300 px-3 py-2 font-bold text-sm focus:border-teal-500 focus:outline-none"
                />
                <select
                  value={bulkClasses[s.id] ?? s.className ?? "٦/١"}
                  onChange={(e) => setBulkClasses((b) => ({ ...b, [s.id]: e.target.value }))}
                  className="shrink-0 rounded-lg border-2 border-slate-300 px-2 py-1.5 font-black text-[11px] text-slate-700 focus:border-teal-500 focus:outline-none"
                >
                  <option value="٦/١">٦/١</option>
                  <option value="٦/٢">٦/٢</option>
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const list = filtered.filter((orig) => {
                  const newName = (bulkNames[orig.id] ?? orig.studentName).trim();
                  const newCls = bulkClasses[orig.id] ?? orig.className ?? "٦/١";
                  return (
                    (newName !== orig.studentName && newName.length >= 3) || newCls !== orig.className
                  );
                });
                if (!list.length) {
                  setNotice({ type: "err", text: "لا توجد تعديلات جديدة للحفظ." });
                  setTimeout(() => setNotice(null), 3500);
                  return;
                }
                for (const orig of list) {
                  const newName = (bulkNames[orig.id] ?? orig.studentName).trim();
                  const newCls = bulkClasses[orig.id] ?? orig.className ?? "٦/١";
                  await renameStudent(
                    orig.id,
                    newName.length >= 3 ? newName : orig.studentName,
                    newCls
                  );
                  setStudents((arr) =>
                    arr.map((s) =>
                      s.id === orig.id
                        ? {
                            ...s,
                            studentName: newName.length >= 3 ? newName : s.studentName,
                            className: newCls,
                            updatedAt: new Date().toISOString(),
                          }
                        : s
                    )
                  );
                }
                setNotice({
                  type: "ok",
                  text: `تم تحديث ${list.length} طالب (اسم وفصل) مع الاحتفاظ ببياناتهم ✅`,
                });
                setTimeout(() => setNotice(null), 4500);
                setBulkOpen(false);
                setBulkNames({});
                setBulkClasses({});
              }}
              className="flex-1 rounded-xl bg-teal-700 text-white font-black py-3 hover:bg-teal-800 transition-colors"
            >
              💾 حفظ الكل
            </button>
            <button onClick={() => setBulkOpen(false)} className="rounded-xl bg-slate-100 text-slate-600 font-bold px-5 py-3 hover:bg-slate-200">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    )}
    {classEdit && (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur flex items-center justify-center p-4 print:hidden">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-slidein">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-black text-teal-900 flex items-center gap-2">🏫 تغيير فصل الطالب</h3>
            <button onClick={() => setClassEdit(null)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none">
              ×
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
            <p className="font-extrabold text-slate-800">{classEdit.name}</p>
            <p className="text-slate-500 font-bold text-xs mt-1">الفصل الحالي: {classEdit.cls}</p>
          </div>

          <label className="block font-extrabold text-slate-700 mb-2 text-sm">اختر الفصل الجديد</label>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {["٦/١", "٦/٢"].map((c) => (
              <button
                key={c}
                onClick={() => setClassEdit({ ...classEdit, cls: c })}
                className={`rounded-xl py-3 font-black text-lg border-2 transition-all ${
                  classEdit.cls === c
                    ? "bg-teal-700 border-teal-700 text-white shadow-md"
                    : "bg-white border-slate-300 text-slate-600 hover:border-teal-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-5">
            <p className="text-emerald-900 font-bold text-xs leading-relaxed">
              ✅ سيُحفظ الفصل الجديد فقط. اسم الطالب ودرجته وتقدمه وإجاباته لن تتأثر.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void saveClass()}
              className="flex-1 rounded-xl bg-teal-700 text-white font-black py-3 hover:bg-teal-800 transition-colors"
            >
              💾 حفظ الفصل
            </button>
            <button
              onClick={() => setClassEdit(null)}
              className="rounded-xl bg-slate-100 text-slate-600 font-bold px-5 py-3 hover:bg-slate-200"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    )}
    {editing && (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur flex items-center justify-center p-4 print:hidden">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-slidein">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-black text-teal-900 flex items-center gap-2">✏️ تعديل اسم الطالب</h3>
            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none">
              ×
            </button>
          </div>

          <label className="block font-extrabold text-slate-700 mb-2 text-sm">اسم الطالب (ثلاثي)</label>
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && void saveRename()}
            placeholder="مثال: عبدالله محمد العتيبي"
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 font-bold focus:border-teal-500 focus:outline-none mb-4"
          />

          <label className="block font-extrabold text-slate-700 mb-2 text-sm">الفصل</label>
          <div className="flex gap-2 mb-5">
            {["٦/١", "٦/٢"].map((c) => (
              <button
                key={c}
                onClick={() => setEditing({ ...editing, cls: c })}
                className={`rounded-xl px-5 py-2 font-extrabold border-2 transition-all ${
                  editing.cls === c ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-slate-300 text-slate-600 hover:border-teal-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-5">
            <p className="text-emerald-900 font-bold text-xs leading-relaxed">
              ✅ لن تتأثر بيانات الطالب: التقدم في الدرس، درجة الاختبار، وإجابات الأنشطة تبقى كما هي. يُحفظ الاسم الجديد فقط.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void saveRename()}
              disabled={saving}
              className="flex-1 rounded-xl bg-teal-700 text-white font-black py-3 hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              {saving ? "⏳ جارٍ الحفظ…" : "💾 حفظ التعديل"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-xl bg-slate-100 text-slate-600 font-bold px-5 py-3 hover:bg-slate-200"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    )}
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

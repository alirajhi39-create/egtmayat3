import type { StudentProgress } from "../lib/progress";

const pctOf = (s: StudentProgress) => Math.min(100, Math.round(((s.maxSlide + 1) / (s.totalSlides || 14)) * 100));
const scoreOf = (s: StudentProgress) =>
  s.quizScore != null ? `${s.quizScore}/${s.quizTotal ?? 8}` : "لم يُنجز";
const scorePct = (s: StudentProgress) =>
  s.quizScore != null ? Math.round((s.quizScore / (s.quizTotal || 8)) * 100) : null;
const fmt = (d: string) => {
  try {
    return new Date(d).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
};

/**
 * تقرير مخصص للطباعة / الحفظ كـ PDF.
 * مخفي على الشاشة، ويظهر فقط عند الطباعة (print:block).
 */
export function PrintReport({
  students,
  title,
  includeActivities,
  includeQuiz,
}: {
  students: StudentProgress[];
  title: string;
  includeActivities: boolean;
  includeQuiz: boolean;
}) {
  const n = students.length;
  const finished = students.filter((s) => s.quizScore != null).length;
  const avgProg = n ? Math.round(students.reduce((a, s) => a + pctOf(s), 0) / n) : 0;
  const scored = students.filter((s) => s.quizScore != null);
  const avgScore = scored.length ? Math.round(scored.reduce((a, s) => a + (scorePct(s) || 0), 0) / scored.length) : 0;
  const single = n === 1;

  return (
    <div dir="rtl" className="hidden print:block bg-white text-slate-900 text-[12px] leading-relaxed">
      {/* ترويسة التقرير */}
      <div className="border-b-4 border-teal-800 pb-3 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold text-slate-500">المملكة العربية السعودية • وزارة التعليم</p>
            <h1 className="text-2xl font-black text-teal-900 mt-1">{title}</h1>
            <p className="font-bold text-slate-600 mt-1">
              درس: تأسيس الدولة السعودية الثانية — الدراسات الاجتماعية — الصف السادس
            </p>
          </div>
          <div className="text-left shrink-0 text-[11px] font-bold text-slate-600 leading-6">
            <p>🏫 مدرسة العروس الابتدائية</p>
            <p>👨‍🏫 المعلم: علي عبدالله راجحي</p>
            <p>📅 {new Date().toLocaleDateString("ar-SA", { dateStyle: "long" })}</p>
          </div>
        </div>
      </div>

      {/* ملخص الفصل */}
      {!single && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            ["عدد الطلاب", String(n)],
            ["أنهوا الدرس", `${finished}`],
            ["متوسط التقدم", `${avgProg}٪`],
            ["متوسط الدرجات", `${avgScore}٪`],
          ].map(([l, v]) => (
            <div key={l} className="avoid-break rounded-lg border-2 border-teal-200 bg-teal-50 p-3 text-center">
              <p className="text-xl font-black text-teal-800">{v}</p>
              <p className="font-bold text-slate-600 text-[11px]">{l}</p>
            </div>
          ))}
        </div>
      )}

      {/* جدول الطلاب */}
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="bg-teal-800 text-white">
            {["#", "اسم الطالب", "الفصل", "التقدم في الدرس", "درجة الاختبار", "آخر نشاط"].map((h) => (
              <th key={h} className="border border-teal-900 px-2 py-2 text-right font-extrabold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => {
            const sp = scorePct(s);
            return (
              <tr key={s.id} className={`avoid-break ${i % 2 ? "bg-slate-50" : "bg-white"}`}>
                <td className="border border-slate-300 px-2 py-1.5 font-bold text-center">{i + 1}</td>
                <td className="border border-slate-300 px-2 py-1.5 font-extrabold">{s.studentName}</td>
                <td dir="ltr" className="border border-slate-300 px-2 py-1.5 text-center font-bold">{s.className || "—"}</td>
                <td className="border border-slate-300 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-600" style={{ width: `${pctOf(s)}%` }} />
                    </div>
                    <span className="font-black text-[11px] w-9 text-left">{pctOf(s)}٪</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold">
                    الشريحة {s.maxSlide + 1} من {s.totalSlides}
                  </p>
                </td>
                <td
                  className={`border border-slate-300 px-2 py-1.5 text-center font-black ${
                    sp == null ? "text-slate-400" : sp >= 70 ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {scoreOf(s)}
                  {sp != null && <span className="block text-[10px] font-bold">({sp}٪)</span>}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-600">{fmt(s.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* إجابات الأنشطة وأسئلة التقويم (حسب الخيارات المحددة) */}
      {(includeActivities || includeQuiz) && (
        <div>
          <h2 className="text-lg font-black text-rose-800 border-b-2 border-rose-200 pb-1 mb-3">
            📝{" "}
            {includeActivities && includeQuiz
              ? "إجابات الطلاب في الأنشطة وأسئلة التقويم"
              : includeActivities
              ? "إجابات الطلاب في الأنشطة"
              : "إجابات الطلاب في أسئلة التقويم"}
          </h2>
          {students.map((s) => {
            const entries = Object.entries(s.activities || {});
            const activities = includeActivities ? entries.filter(([k]) => !k.startsWith("التقويم")) : [];
            const quiz = includeQuiz ? entries.filter(([k]) => k.startsWith("التقويم")) : [];
            const nothing = activities.length === 0 && quiz.length === 0;
            return (
              <div key={s.id} className="avoid-break rounded-lg border-2 border-slate-200 p-3 mb-3">
                <p className="font-black text-teal-900 mb-2">
                  👤 {s.studentName} <span className="text-slate-500 font-bold text-[11px]">— الفصل <bdi dir="ltr">{s.className || "—"}</bdi></span>
                </p>
                {nothing ? (
                  <p className="text-slate-400 font-bold text-[11px]">لم يسجّل الطالب أي إجابة بعد.</p>
                ) : (
                  <>
                    {activities.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {activities.map(([k, v]) => (
                          <div key={k} className="rounded bg-slate-50 border border-slate-200 px-2 py-1">
                            <span className="font-extrabold text-rose-700">{k}: </span>
                            <span className="font-semibold whitespace-pre-wrap">
                              {typeof v === "object" ? JSON.stringify(v) : String(v) || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {quiz.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {quiz.map(([k, v]) => (
                          <div key={k} className="rounded bg-white border border-slate-200 px-2 py-1 text-[11px]">
                            <span className="font-extrabold text-teal-800">{k.replace("التقويم-", "")}: </span>
                            <span className="font-semibold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* تذييل */}
      <div className="mt-8 pt-3 border-t-2 border-slate-300 flex items-end justify-between text-[11px] font-bold text-slate-500">
        <p>تم إنشاء هذا التقرير آلياً من نظام الدرس التفاعلي • مدرسة العروس الابتدائية</p>
        <div className="text-center">
          <p className="mb-6">توقيع المعلم</p>
          <p>علي عبدالله راجحي</p>
        </div>
      </div>
    </div>
  );
}

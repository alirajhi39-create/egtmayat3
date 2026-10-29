import { useState } from "react";
import { CLASSES } from "../lib/classes";

type Props = {
  connected: boolean;
  loading: boolean;
  classFilter: string;
  count: number;
  error: string | null;
  onRefresh: () => void;
  onSelectClass: (value: string) => void;
};

export function SharedRegister({ connected, loading, classFilter, count, error, onRefresh, onSelectClass }: Props) {
  const [choosingClass, setChoosingClass] = useState(false);
  const checking = loading && !connected;

  return (
    <section
      aria-label="حالة السجل المشترك"
      className={`mb-6 rounded-2xl border px-4 py-4 sm:px-5 ${connected ? "border-teal-200 bg-teal-50" : "border-amber-200 bg-amber-50"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${connected ? "bg-teal-800" : "bg-amber-700"}`}>
            {connected ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span aria-hidden="true" className="text-lg font-bold">!</span>
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 aria-live="polite" className="font-extrabold text-teal-950">
                {checking ? "جارٍ التحقق من السجل المشترك" : connected ? "السجل المشترك متصل" : "السجل المشترك غير متصل"}
              </h2>
              <span className="rounded-full border border-teal-100 bg-white px-2 py-1 text-xs font-bold text-teal-800">
                {classFilter ? <>الفصل <bdi dir="ltr">{classFilter}</bdi></> : "جميع الفصول"}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">
                {checking ? "جارٍ الاتصال" : connected ? "PostgreSQL (Neon)" : "حفظ على هذا الجهاز فقط"}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-teal-800">
              {connected
                ? classFilter
                  ? "الطلاب الذين يختارون هذا الفصل من أي جهاز يظهرون هنا تلقائياً."
                  : "طلاب الفصلين الذين يفتحون الدرس من أي جهاز يظهرون هنا تلقائياً."
                : checking ? "جارٍ جلب بيانات الطلاب من قاعدة Neon." : error || "تحقق من اتصال قاعدة البيانات ثم حدّث السجل."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-teal-100 bg-white px-3 py-2 text-xs font-extrabold text-teal-800">
            {count} {connected ? "في السجل" : "على هذا الجهاز"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-xl bg-teal-100 px-4 py-2 text-sm font-extrabold text-teal-900 transition-colors hover:bg-teal-200 disabled:opacity-50"
          >
            تحديث
          </button>
          <button
            type="button"
            onClick={() => setChoosingClass((value) => !value)}
            aria-label="تحديد فصل السجل"
            aria-expanded={choosingClass}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-200 bg-white text-teal-800 transition-colors hover:bg-teal-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d="m4 16-.5 4.5L8 20 19 9a2.1 2.1 0 0 0-3-3L5 17Z" strokeLinejoin="round" />
              <path d="m14 8 3 3" />
            </svg>
          </button>
        </div>
      </div>

      {choosingClass && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-teal-200 pt-4">
          <span className="text-xs font-bold text-teal-900">اعرض سجل:</span>
          {["", ...CLASSES].map((value) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => { onSelectClass(value); setChoosingClass(false); }}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${classFilter === value ? "bg-teal-800 text-white" : "bg-white text-teal-800 hover:bg-teal-100"}`}
            >
              {value ? <bdi dir="ltr">{value}</bdi> : "جميع الفصول"}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
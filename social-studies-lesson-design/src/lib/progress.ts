/**
 * إدارة تقدم الطالب: يحفظ محلياً دائماً، ويزامن مع قاعدة بيانات Neon
 * عبر /api/progress إذا كانت متاحة (على Vercel).
 */

export type StudentProgress = {
  id: string;
  studentName: string;
  className: string;
  maxSlide: number;
  totalSlides: number;
  quizScore: number | null;
  quizTotal: number | null;
  activities: Record<string, any>;
  startedAt: string;
  updatedAt: string;
};

const LS_SESSION = "lesson2_session";
const LS_LOCAL_DB = "lesson2_local_students";
const LS_RENAMED = "lesson2_teacher_renamed";

export let online = true;

/* ============ الجلسة الحالية ============ */
export function getSession(): StudentProgress | null {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    return raw ? (JSON.parse(raw) as StudentProgress) : null;
  } catch {
    return null;
  }
}

export function createSession(studentName: string, className: string, totalSlides: number): StudentProgress {
  const existing = getSession();
  const sameStudent = existing && existing.studentName === studentName;

  const session: StudentProgress = {
    id:
      sameStudent
        ? existing.id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentName,
    className,
    maxSlide: sameStudent ? existing.maxSlide : 0,
    totalSlides,
    quizScore: sameStudent ? existing.quizScore : null,
    quizTotal: sameStudent ? existing.quizTotal : null,
    activities: sameStudent ? existing.activities : {},
    startedAt: sameStudent ? existing.startedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(LS_SESSION, JSON.stringify(session));
  saveLocal(session);
  void push(session);
  void restoreFromServer(studentName, className, session.id);
  return session;
}

/**
 * استرجاع بيانات الطالب السابقة من الخادم عند الدخول بنفس الاسم.
 * يحافظ على التقدّم والدرجة والأنشطة السابقة حتى لو كان المتصفح الجديد.
 */
async function restoreFromServer(studentName: string, className: string, newId: string) {
  try {
    const res = await fetch(`/api/progress?name=${encodeURIComponent(studentName)}&class=${encodeURIComponent(className)}`);
    if (!res.ok) return;
    const data = await res.json();
    const found = (data.students || [])[0] as any;
    if (!found) return;

    // نستخدم نفس معرّف السجل القديم حتى تُستعاد كل بياناته على الـ id نفسه
    const restored: StudentProgress = {
      id: found.id,
      studentName: found.student_name || studentName,
      className: found.class_name || className,
      maxSlide: found.max_slide ?? 0,
      totalSlides: found.total_slides ?? 14,
      quizScore: found.quiz_score ?? null,
      quizTotal: found.quiz_total ?? null,
      activities: found.activities || {},
      startedAt: found.started_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const sess = getSession();
    if (sess && sess.id === newId) {
      localStorage.setItem(LS_SESSION, JSON.stringify(restored));
      saveLocal(restored);
      void push(restored);
    }
  } catch {}
}

export function endSession() {
  localStorage.removeItem(LS_SESSION);
}

/* ============ التحديث ============ */
let timer: ReturnType<typeof setTimeout> | null = null;

export function updateProgress(patch: Partial<StudentProgress>): StudentProgress | null {
  const s = getSession();
  if (!s) return null;
  const next: StudentProgress = {
    ...s,
    ...patch,
    // التقدم والدرجة لا ينقصان أبداً
    maxSlide: Math.max(s.maxSlide, patch.maxSlide ?? 0),
    quizScore:
      patch.quizScore === null || patch.quizScore === undefined
        ? s.quizScore
        : Math.max(s.quizScore ?? 0, patch.quizScore),
    // الأنشطة تُدمج ولا تُستبدل
    activities: { ...s.activities, ...(patch.activities || {}) },
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(LS_SESSION, JSON.stringify(next));
  saveLocal(next);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void push(next), 800); // تجميع الحفظ لتقليل الطلبات
  return next;
}

export function recordActivity(key: string, value: any) {
  return updateProgress({ activities: { [key]: value } });
}

/* ============ المزامنة مع الخادم ============ */
async function push(s: StudentProgress) {
  try {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    online = res.ok;
  } catch {
    online = false;
  }
}

/** هل الاسم المعتمد لهذا الطالب جاء من تعديل المعلم؟ */
export function isTeacherRenamed(id: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(LS_RENAMED) || "{}")[id] === true;
  } catch {
    return false;
  }
}

/* ============ تخزين محلي احتياطي للوحة المعلم ============ */
function saveLocal(s: StudentProgress) {
  try {
    const all = readLocal();
    const idx = all.findIndex((x) => x.id === s.id);
    if (idx >= 0) all[idx] = s;
    else all.push(s);
    localStorage.setItem(LS_LOCAL_DB, JSON.stringify(all));
  } catch {}
}

export function readLocal(): StudentProgress[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_LOCAL_DB) || "[]");
    // ترحيل أسماء الفصول القديمة إلى الصيغة الجديدة
    const migrated = raw.map((s: StudentProgress) => ({
      ...s,
      className:
        s.className === "6 / أ" || s.className === "6/أ"
          ? "٦/١"
          : s.className === "6 / ب" || s.className === "6/ب"
          ? "٦/٢"
          : s.className,
    }));
    return migrated;
  } catch {
    return [];
  }
}

export function clearLocal() {
  localStorage.removeItem(LS_LOCAL_DB);
}

/* ============ جلب بيانات لوحة المعلم ============ */
export async function fetchStudents(): Promise<{ students: StudentProgress[]; source: "neon" | "local" }> {
  try {
    const res = await fetch("/api/progress");
    if (!res.ok) throw new Error();
    const data = await res.json();
    const students: StudentProgress[] = (data.students || []).map((r: any) => ({
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
    return { students, source: "neon" };
  } catch {
    return { students: readLocal().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)), source: "local" };
  }
}

/**
 * تعديل اسم الطالب (وفصله) من لوحة المعلم — مع الحفاظ على كل بياناته السابقة.
 * السجل يبقى بنفس الـ id، فتُحفظikawa الدرجة والأنشطة والتقدم كما هي.
 */
export async function renameStudent(
  id: string,
  studentName: string,
  className?: string
): Promise<{ ok: boolean; synced: boolean }> {
  const all = readLocal();
  const idx = all.findIndex((x) => x.id === id);
  const current = idx >= 0 ? all[idx] : null;

  // تحديث النسخة المحلية دائماً (تظهر فوراً في اللوحة)
  if (current) {
    const updated: StudentProgress = {
      ...current,
      studentName,
      className: className ?? current.className,
      updatedAt: new Date().toISOString(),
    };
    const copy = [...all];
    copy[idx] = updated;
    try {
      localStorage.setItem(LS_LOCAL_DB, JSON.stringify(copy));
    } catch {}
    saveLocal(updated);
  }

  // إذا كان الاسم الجديد يخص الجلسة المفتوحة على هذا الجهاز
  const sess = getSession();
  if (sess && sess.id === id) {
    const updatedSession: StudentProgress = {
      ...sess,
      studentName,
      className: className ?? sess.className,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(LS_SESSION, JSON.stringify(updatedSession));
  }

  try {
    const map = JSON.parse(localStorage.getItem(LS_RENAMED) || "{}");
    map[id] = true;
    localStorage.setItem(LS_RENAMED, JSON.stringify(map));
  } catch {}

  // مزامنة مع قاعدة البيانات
  try {
    const res = await fetch(`/api/progress?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentName, className }),
    });
    return { ok: res.ok, synced: res.ok };
  } catch {
    return { ok: true, synced: false };
  }
}

/** تعديل الفصل فقط — لا يغيّر الاسم المعتمد من المعلم ولا أي بيانات أخرى */
export async function changeStudentClass(id: string, className: string): Promise<boolean> {
  const current = readLocal().find((x) => x.id === id) ?? (getSession()?.id === id ? getSession() : null);
  const name = current?.studentName;
  if (!name) return false;
  const r = await renameStudent(id, name, className);
  return r.ok;
}

/** حذف طالب واحد من قاعدة البيانات ومن التخزين المحلي */
export async function deleteStudent(id: string): Promise<boolean> {
  let ok = true;
  try {
    const res = await fetch(`/api/progress?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    ok = res.ok;
  } catch {
    ok = false; // لا يوجد اتصال بالخادم — نحذف المحلي فقط
  }
  try {
    localStorage.setItem(LS_LOCAL_DB, JSON.stringify(readLocal().filter((s) => s.id !== id)));
  } catch {}
  // إذا كان المحذوف هو جلسة هذا الجهاز نُنهيها حتى لا يُعاد إنشاؤه تلقائياً
  if (getSession()?.id === id) {
    if (timer) clearTimeout(timer);
    endSession();
  }
  return ok;
}

export async function deleteAllRemote() {
  try {
    await fetch("/api/progress", { method: "DELETE" });
  } catch {}
  clearLocal();
}

/* ============ تصدير CSV ============ */
export function toCSV(students: StudentProgress[]): string {
  const headers = ["اسم الطالب", "الصف", "الشرائح المنجزة", "نسبة التقدم", "درجة الاختبار", "آخر نشاط", "إجابات الأنشطة"];
  const lines = students.map((s) => {
    const pct = Math.round(((s.maxSlide + 1) / (s.totalSlides || 14)) * 100);
    const acts = Object.entries(s.activities || {})
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" | ");
    return [
      s.studentName,
      s.className,
      `${s.maxSlide + 1}/${s.totalSlides}`,
      `${pct}%`,
      s.quizScore != null ? `${s.quizScore}/${s.quizTotal ?? 8}` : "لم يُنجز",
      new Date(s.updatedAt).toLocaleString("ar-SA"),
      acts,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(",");
  });
  return "\uFEFF" + [headers.join(","), ...lines].join("\n");
}

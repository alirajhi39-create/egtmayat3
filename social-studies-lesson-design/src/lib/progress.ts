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
  const session: StudentProgress = {
    id:
      existing && existing.studentName === studentName
        ? existing.id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentName,
    className,
    maxSlide: existing && existing.studentName === studentName ? existing.maxSlide : 0,
    totalSlides,
    quizScore: existing && existing.studentName === studentName ? existing.quizScore : null,
    quizTotal: null,
    activities: existing && existing.studentName === studentName ? existing.activities : {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(LS_SESSION, JSON.stringify(session));
  saveLocal(session);
  void push(session);
  return session;
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
    maxSlide: Math.max(s.maxSlide, patch.maxSlide ?? 0),
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
    return JSON.parse(localStorage.getItem(LS_LOCAL_DB) || "[]");
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

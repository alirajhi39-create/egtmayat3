/**
 * إدارة تقدم الطالب: يحفظ محلياً دائماً، ويزامن مع قاعدة بيانات Neon
 * عبر /api/progress إذا كانت متاحة (على Vercel).
 */
import { isClassName, normalizeClassName } from "./classes";

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
export const SESSION_UPDATED_EVENT = "lesson2:session-updated";

export let online = true;

/* ============ الجلسة الحالية ============ */
export function getSession(): StudentProgress | null {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw) as StudentProgress;
    return { ...session, className: normalizeClassName(session.className) };
  } catch {
    return null;
  }
}

export function createSession(studentName: string, className: string, totalSlides: number): StudentProgress {
  const existing = getSession();
  const sameStudent = existing?.studentName === studentName;
  const session: StudentProgress = {
    id: sameStudent ? existing.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentName,
    className: normalizeClassName(className),
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
    if (res.ok) {
      const data = await res.json();
      applyCanonicalDetails(s.id, data);
    }
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
    const students = JSON.parse(localStorage.getItem(LS_LOCAL_DB) || "[]") as StudentProgress[];
    return students.map((student) => ({ ...student, className: normalizeClassName(student.className) }));
  } catch {
    return [];
  }
}

/** إبقاء اسم الطالب وفصله المعتمدين من المعلم رغم طلبات الحفظ القديمة. */
function applyCanonicalDetails(id: string, details: { studentName?: unknown; className?: unknown }) {
  const name = typeof details.studentName === "string" ? details.studentName : undefined;
  const className = typeof details.className === "string" ? normalizeClassName(details.className) : undefined;
  const session = getSession();
  if (session?.id === id && (name && session.studentName !== name || className !== undefined && session.className !== className)) {
    localStorage.setItem(LS_SESSION, JSON.stringify({ ...session, studentName: name || session.studentName, className: className ?? session.className }));
    window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
  }
  const local = readLocal();
  const index = local.findIndex((student) => student.id === id);
  if (index !== -1 && (name && local[index].studentName !== name || className !== undefined && local[index].className !== className)) {
    local[index] = { ...local[index], studentName: name || local[index].studentName, className: className ?? local[index].className };
    localStorage.setItem(LS_LOCAL_DB, JSON.stringify(local));
  }
}

/** تحديث اسم الطالب وفصله في الجلسة عند تعديل المعلم من جهاز آخر. */
export async function refreshSessionDetails() {
  const session = getSession();
  if (!session) return;
  try {
    const res = await fetch(`/api/progress?id=${encodeURIComponent(session.id)}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    applyCanonicalDetails(session.id, data);
  } catch {}
}

/** تحديث بيانات السجل المحددة فقط؛ لا يتغير المعرف أو التقدم أو الإجابات. */
export async function updateStudentDetails(id: string, details: { studentName?: string; className?: string }) {
  const patch: { studentName?: string; className?: string } = {};
  if (details.studentName !== undefined) {
    const normalized = details.studentName.replace(/\s+/g, " ").trim();
    if (normalized.length < 3 || normalized.length > 100) throw new Error("الاسم يجب أن يكون بين ٣ و١٠٠ حرف");
    patch.studentName = normalized;
  }
  if (details.className !== undefined) {
    const normalized = normalizeClassName(details.className);
    if (!isClassName(normalized)) throw new Error("اختر الفصل 6 / أ أو 6 / ب");
    patch.className = normalized;
  }
  if (!Object.keys(patch).length) throw new Error("حدد الاسم أو الفصل المراد تعديله");
  const res = await fetch(`/api/progress?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || typeof data.studentName !== "string") {
    throw new Error(data.error || "تعذر حفظ بيانات الطالب في قاعدة Neon. تحقق من الاتصال وأعد المحاولة.");
  }
  applyCanonicalDetails(id, data);
  return { studentName: data.studentName as string, className: typeof data.className === "string" ? normalizeClassName(data.className) : undefined };
}

export async function renameStudent(id: string, name: string): Promise<string> {
  const saved = await updateStudentDetails(id, { studentName: name });
  return saved.studentName;
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
      className: normalizeClassName(r.class_name),
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

/** نسخة احتياطية تشمل سجلات Neon وأي سجلات أقدم لم تُرفع من هذا الجهاز. */
export function makeBackup(students: StudentProgress[]) {
  const ids = new Set(students.map((student) => student.id));
  const localOnly = readLocal().filter((student) => !ids.has(student.id));
  return JSON.stringify({ version: 1, lessonSlug: "saudi-state-2", exportedAt: new Date().toISOString(), students: [...students, ...localOnly] }, null, 2);
}

export function localOnlyStudents(students: StudentProgress[]) {
  const ids = new Set(students.map((student) => student.id));
  return readLocal().filter((student) => !ids.has(student.id));
}

/** استعادة السجلات غير الموجودة فقط حتى لا تستبدل النسخة القديمة عمل الطلاب الجديد. */
export async function restoreMissingStudents(records: StudentProgress[], existingIds: string[]) {
  const known = new Set(existingIds);
  let restored = 0;
  let skipped = 0;
  let failed = 0;
  const missing = records.filter((student) => {
    if (known.has(student.id)) return false;
    known.add(student.id);
    return true;
  });
  for (let i = 0; i < missing.length; i += 3) {
    const results = await Promise.all(missing.slice(i, i + 3).map(async (student) => {
      try {
        const res = await fetch("/api/progress?restore=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(student),
        });
        const data = await res.json();
        return res.ok && data.ok ? (data.created ? "restored" : "skipped") : "failed";
      } catch { return "failed"; }
    }));
    restored += results.filter((result) => result === "restored").length;
    skipped += results.filter((result) => result === "skipped").length;
    failed += results.filter((result) => result === "failed").length;
  }
  return { restored, skipped, failed };
}

export function parseBackup(text: string): StudentProgress[] {
  let backup: any;
  try { backup = JSON.parse(text); } catch { throw new Error("الملف ليس نسخة احتياطية صالحة"); }
  if (backup?.lessonSlug !== "saudi-state-2" || !Array.isArray(backup.students) || backup.students.length > 2000) {
    throw new Error("النسخة الاحتياطية غير صالحة لهذا الدرس أو تحتوي على عدد كبير جداً من السجلات");
  }
  return backup.students.map((raw: any) => {
    const id = typeof raw?.id === "string" ? raw.id.trim() : "";
    const studentName = typeof raw?.studentName === "string" ? raw.studentName.replace(/\s+/g, " ").trim() : "";
    if (!id || id.length > 120 || studentName.length < 3 || studentName.length > 100) {
      throw new Error("النسخة تحتوي على سجل طالب غير صالح");
    }
    const validDate = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : new Date().toISOString();
    const numberOrNull = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
    return {
      id,
      studentName,
      className: normalizeClassName(raw.className),
      maxSlide: numberOrNull(raw.maxSlide) ?? 0,
      totalSlides: numberOrNull(raw.totalSlides) || 14,
      quizScore: numberOrNull(raw.quizScore),
      quizTotal: numberOrNull(raw.quizTotal),
      activities: raw.activities && typeof raw.activities === "object" && !Array.isArray(raw.activities) ? raw.activities : {},
      startedAt: validDate(raw.startedAt),
      updatedAt: validDate(raw.updatedAt),
    } satisfies StudentProgress;
  });
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
  const headers = ["اسم الطالب", "الفصل", "الشرائح المنجزة", "نسبة التقدم", "درجة الاختبار", "آخر نشاط", "إجابات الأنشطة"];
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

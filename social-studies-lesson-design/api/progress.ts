import { neon } from "@neondatabase/serverless";

/**
 * واجهة برمجية واحدة لإدارة تقدم الطلاب.
 * متغير البيئة المطلوب على Vercel:  DATABASE_URL  (رابط Neon)
 */

const sqlClient = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير معرّف");
  return neon(url);
};

async function ensureTable(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id            TEXT PRIMARY KEY,
      student_name  TEXT NOT NULL,
      class_name    TEXT,
      lesson_slug   TEXT NOT NULL DEFAULT 'saudi-state-2',
      max_slide     INT  NOT NULL DEFAULT 0,
      total_slides  INT  NOT NULL DEFAULT 14,
      quiz_score    INT,
      quiz_total    INT,
      activities    JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const sql = sqlClient();
    await ensureTable(sql);

    /* ===== حفظ / تحديث تقدم طالب ===== */
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const {
        id,
        studentName,
        className = "",
        lessonSlug = "saudi-state-2",
        maxSlide = 0,
        totalSlides = 14,
        quizScore = null,
        quizTotal = null,
        activities = {},
        startedAt: providedStart,
        updatedAt: providedUpdate,
      } = body;

      if (!id || !studentName) {
        return res.status(400).json({ ok: false, error: "id و studentName مطلوبان" });
      }
      const startedAt = typeof providedStart === "string" && !Number.isNaN(Date.parse(providedStart)) ? providedStart : null;
      const updatedAt = typeof providedUpdate === "string" && !Number.isNaN(Date.parse(providedUpdate)) ? providedUpdate : null;

      // الاستعادة تضيف السجلات الناقصة فقط ولا تمس أي سجل موجود، حتى عند تعارض متزامن.
      if (req.query?.restore === "1") {
        const inserted = await sql`
          INSERT INTO lesson_progress
            (id, student_name, class_name, lesson_slug, max_slide, total_slides, quiz_score, quiz_total, activities, started_at, updated_at)
          VALUES
            (${id}, ${studentName}, ${className}, ${lessonSlug}, ${maxSlide}, ${totalSlides},
             ${quizScore}, ${quizTotal}, ${JSON.stringify(activities)}::jsonb,
             COALESCE(${startedAt}::timestamptz, now()), COALESCE(${updatedAt}::timestamptz, now()))
          ON CONFLICT (id) DO NOTHING
          RETURNING id;
        `;
        return res.status(200).json({ ok: true, created: inserted.length > 0 });
      }

      // لا يغيّر حفظ التقدم اسم الطالب الموجود؛ تعديل المعلم هو المصدر المعتمد.
      const saved = await sql`
        INSERT INTO lesson_progress
          (id, student_name, class_name, lesson_slug, max_slide, total_slides, quiz_score, quiz_total, activities, started_at, updated_at)
        VALUES
          (${id}, ${studentName}, ${className}, ${lessonSlug}, ${maxSlide}, ${totalSlides},
           ${quizScore}, ${quizTotal}, ${JSON.stringify(activities)}::jsonb,
           COALESCE(${startedAt}::timestamptz, now()), COALESCE(${updatedAt}::timestamptz, now()))
        ON CONFLICT (id) DO UPDATE SET
          class_name   = EXCLUDED.class_name,
          max_slide    = GREATEST(lesson_progress.max_slide, EXCLUDED.max_slide),
          total_slides = EXCLUDED.total_slides,
          quiz_score   = COALESCE(EXCLUDED.quiz_score, lesson_progress.quiz_score),
          quiz_total   = COALESCE(EXCLUDED.quiz_total, lesson_progress.quiz_total),
          activities   = lesson_progress.activities || EXCLUDED.activities,
          updated_at   = now()
        RETURNING student_name;
      `;
      return res.status(200).json({ ok: true, studentName: saved[0].student_name });
    }

    /* ===== تعديل المعلم لاسم طالب موجود دون تغيير بياناته ===== */
    if (req.method === "PATCH") {
      const id = typeof req.query?.id === "string" ? req.query.id.trim() : "";
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const studentName = typeof body.studentName === "string" ? body.studentName.replace(/\s+/g, " ").trim() : "";
      if (!id || studentName.length < 3 || studentName.length > 100) {
        return res.status(400).json({ ok: false, error: "أدخل اسم الطالب الصحيح (٣ إلى ١٠٠ حرف)" });
      }

      const renamed = await sql`
        UPDATE lesson_progress
        SET student_name = ${studentName}, updated_at = now()
        WHERE id = ${id} AND lesson_slug = 'saudi-state-2'
        RETURNING student_name;
      `;
      if (!renamed.length) return res.status(404).json({ ok: false, error: "لم يعد سجل الطالب موجوداً" });
      return res.status(200).json({ ok: true, studentName: renamed[0].student_name });
    }

    /* ===== حذف سجل أو كل السجلات (للمعلم) ===== */
    if (req.method === "DELETE") {
      const id = req.query?.id;
      if (id) await sql`DELETE FROM lesson_progress WHERE id = ${id}`;
      else await sql`DELETE FROM lesson_progress WHERE lesson_slug = 'saudi-state-2'`;
      return res.status(200).json({ ok: true });
    }

    /* ===== جلب كل سجلات الطلاب (لوحة المعلم) ===== */
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "طريقة الطلب غير مدعومة" });

    if (typeof req.query?.id === "string") {
      const rows = await sql`
        SELECT student_name FROM lesson_progress
        WHERE id = ${req.query.id} AND lesson_slug = 'saudi-state-2'
        LIMIT 1;
      `;
      if (!rows.length) return res.status(404).json({ ok: false, error: "لم يعد سجل الطالب موجوداً" });
      return res.status(200).json({ ok: true, studentName: rows[0].student_name });
    }

    const rows = await sql`
      SELECT id, student_name, class_name, max_slide, total_slides,
             quiz_score, quiz_total, activities, started_at, updated_at
      FROM lesson_progress
      WHERE lesson_slug = 'saudi-state-2'
      ORDER BY updated_at DESC
      LIMIT 2000;
    `;
    return res.status(200).json({ ok: true, students: rows });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "خطأ في الخادم" });
  }
}

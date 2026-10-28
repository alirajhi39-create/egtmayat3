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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
      } = body;

      if (!id || !studentName) {
        return res.status(400).json({ ok: false, error: "id و studentName مطلوبان" });
      }

      await sql`
        INSERT INTO lesson_progress
          (id, student_name, class_name, lesson_slug, max_slide, total_slides, quiz_score, quiz_total, activities, updated_at)
        VALUES
          (${id}, ${studentName}, ${className}, ${lessonSlug}, ${maxSlide}, ${totalSlides},
           ${quizScore}, ${quizTotal}, ${JSON.stringify(activities)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET
          student_name = EXCLUDED.student_name,
          class_name   = EXCLUDED.class_name,
          max_slide    = GREATEST(lesson_progress.max_slide, EXCLUDED.max_slide),
          total_slides = EXCLUDED.total_slides,
          quiz_score   = COALESCE(EXCLUDED.quiz_score, lesson_progress.quiz_score),
          quiz_total   = COALESCE(EXCLUDED.quiz_total, lesson_progress.quiz_total),
          activities   = lesson_progress.activities || EXCLUDED.activities,
          updated_at   = now();
      `;
      return res.status(200).json({ ok: true });
    }

    /* ===== حذف سجل أو كل السجلات (للمعلم) ===== */
    if (req.method === "DELETE") {
      const id = req.query?.id;
      if (id) await sql`DELETE FROM lesson_progress WHERE id = ${id}`;
      else await sql`DELETE FROM lesson_progress WHERE lesson_slug = 'saudi-state-2'`;
      return res.status(200).json({ ok: true });
    }

    /* ===== جلب كل سجلات الطلاب (لوحة المعلم) ===== */
    const rows = await sql`
      SELECT id, student_name, class_name, max_slide, total_slides,
             quiz_score, quiz_total, activities, started_at, updated_at
      FROM lesson_progress
      WHERE lesson_slug = 'saudi-state-2'
      ORDER BY updated_at DESC
      LIMIT 500;
    `;
    return res.status(200).json({ ok: true, students: rows });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "خطأ في الخادم" });
  }
}

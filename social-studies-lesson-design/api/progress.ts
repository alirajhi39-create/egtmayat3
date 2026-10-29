import { neon } from "@neondatabase/serverless";
import { isClassName, normalizeClassName } from "../src/lib/classes";

/**
 * واجهة برمجية واحدة لإدارة تقدم الطلاب.
 * متغير البيئة المطلوب على Vercel:  DATABASE_URL  (رابط Neon)
 */

const sqlClient = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير معرّف");
  return neon(url);
};

let tableReady: Promise<void> | null = null;
function ensureTable(sql: any) {
  if (!tableReady) {
    tableReady = (async () => {
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
      // تغيير تسمية الفصول القديمة فقط، من دون مساس بالدرجات أو الإجابات أو التواريخ.
      await sql`
        UPDATE lesson_progress
        SET class_name = CASE
          WHEN replace(class_name, ' ', '') IN ('٦/١', '6/1', '٦/1', '6/١', '٦/أ', '6/أ', '٦/ا', '6/ا')
            THEN '6 / أ'
          ELSE '6 / ب'
        END
        WHERE lesson_slug = 'saudi-state-2'
          AND replace(class_name, ' ', '') IN (
            '٦/١', '6/1', '٦/1', '6/١', '٦/أ', '6/أ', '٦/ا', '6/ا',
            '٦/٢', '6/2', '٦/2', '6/٢', '٦/ب', '6/ب'
          );
      `;
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
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
        className: providedClass = "",
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
      const className = normalizeClassName(providedClass);
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

      // لا يغيّر حفظ التقدم الاسم أو الفصل المعتمدين من المعلم في سجل موجود.
      const saved = await sql`
        INSERT INTO lesson_progress
          (id, student_name, class_name, lesson_slug, max_slide, total_slides, quiz_score, quiz_total, activities, started_at, updated_at)
        VALUES
          (${id}, ${studentName}, ${className}, ${lessonSlug}, ${maxSlide}, ${totalSlides},
           ${quizScore}, ${quizTotal}, ${JSON.stringify(activities)}::jsonb,
           COALESCE(${startedAt}::timestamptz, now()), COALESCE(${updatedAt}::timestamptz, now()))
        ON CONFLICT (id) DO UPDATE SET
          max_slide    = GREATEST(lesson_progress.max_slide, EXCLUDED.max_slide),
          total_slides = EXCLUDED.total_slides,
          quiz_score   = COALESCE(EXCLUDED.quiz_score, lesson_progress.quiz_score),
          quiz_total   = COALESCE(EXCLUDED.quiz_total, lesson_progress.quiz_total),
          activities   = lesson_progress.activities || EXCLUDED.activities,
          updated_at   = now()
        RETURNING student_name, class_name;
      `;
      return res.status(200).json({
        ok: true,
        studentName: saved[0].student_name,
        className: normalizeClassName(saved[0].class_name),
      });
    }

    /* ===== تعديل المعلم لاسم الطالب أو فصله دون تغيير تقدمه ===== */
    if (req.method === "PATCH") {
      const id = typeof req.query?.id === "string" ? req.query.id.trim() : "";
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const hasName = Object.prototype.hasOwnProperty.call(body, "studentName");
      const hasClass = Object.prototype.hasOwnProperty.call(body, "className");
      const studentName = hasName && typeof body.studentName === "string"
        ? body.studentName.replace(/\s+/g, " ").trim() : null;
      const className = hasClass ? normalizeClassName(body.className) : null;
      if (!id || (!hasName && !hasClass)) {
        return res.status(400).json({ ok: false, error: "حدد اسم الطالب أو فصله للتعديل" });
      }
      if (hasName && (!studentName || studentName.length < 3 || studentName.length > 100)) {
        return res.status(400).json({ ok: false, error: "أدخل اسم الطالب الصحيح (٣ إلى ١٠٠ حرف)" });
      }
      if (hasClass && !isClassName(className)) {
        return res.status(400).json({ ok: false, error: "اختر الفصل 6 / أ أو 6 / ب" });
      }

      const updated = await sql`
        UPDATE lesson_progress
        SET student_name = COALESCE(${studentName}, student_name),
            class_name = COALESCE(${className}, class_name),
            updated_at = now()
        WHERE id = ${id} AND lesson_slug = 'saudi-state-2'
        RETURNING student_name, class_name;
      `;
      if (!updated.length) return res.status(404).json({ ok: false, error: "لم يعد سجل الطالب موجوداً" });
      return res.status(200).json({
        ok: true,
        studentName: updated[0].student_name,
        className: normalizeClassName(updated[0].class_name),
      });
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
        SELECT student_name, class_name FROM lesson_progress
        WHERE id = ${req.query.id} AND lesson_slug = 'saudi-state-2'
        LIMIT 1;
      `;
      if (!rows.length) return res.status(404).json({ ok: false, error: "لم يعد سجل الطالب موجوداً" });
      return res.status(200).json({
        ok: true,
        studentName: rows[0].student_name,
        className: normalizeClassName(rows[0].class_name),
      });
    }

    const rows = await sql`
      SELECT id, student_name, class_name, max_slide, total_slides,
             quiz_score, quiz_total, activities, started_at, updated_at
      FROM lesson_progress
      WHERE lesson_slug = 'saudi-state-2'
      ORDER BY updated_at DESC
      LIMIT 2000;
    `;
    return res.status(200).json({
      ok: true,
      students: rows.map((row: any) => ({ ...row, class_name: normalizeClassName(row.class_name) })),
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "خطأ في الخادم" });
  }
}

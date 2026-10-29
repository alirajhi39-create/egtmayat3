import { neon } from "@neondatabase/serverless";
import { normalizeClassName } from "../src/lib/classes";

/**
 * واجهة برمجية واحدة لإدارة تقدم الطلاب.
 * متغير البيئة المطلوب على Vercel:  DATABASE_URL  (رابط Neon)
 */

const sqlClient = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw Object.assign(new Error("DATABASE_URL غير معرّف"), { code: "DATABASE_URL_MISSING" });
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
      // إرجاع تسميات الفصل إلى ٦/١ و٦/٢. لا يتغير أي حقل آخر في سجلات الطلاب.
      try {
        await sql`
          UPDATE lesson_progress
          SET class_name = CASE
            WHEN replace(class_name, ' ', '') IN ('6/أ', '٦/أ', '6/ا', '٦/ا', '6/1', '٦/1', '6/١')
              THEN '٦/١'
            ELSE '٦/٢'
          END
          WHERE lesson_slug = 'saudi-state-2'
            AND class_name NOT IN ('٦/١', '٦/٢')
            AND replace(class_name, ' ', '') IN (
              '6/أ', '٦/أ', '6/ا', '٦/ا', '6/1', '٦/1', '6/١', '٦/١',
              '6/ب', '٦/ب', '6/2', '٦/2', '6/٢', '٦/٢'
            );
        `;
      } catch (error) {
        // فشل تغيير اسم الفصل لا يجوز أن يحجب السجلات والإجابات الموجودة.
        console.error("Class label migration could not run", error instanceof Error ? error.message : "unknown error");
      }
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

      // لا يغيّر حفظ التقدم الاسم أو الفصل في سجل موجود حتى مع جهاز يستخدم الإصدار الأقدم.
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

    /* ===== تعديل اسم الطالب فقط دون تغيير فصله أو تقدمه ===== */
    if (req.method === "PATCH") {
      const id = typeof req.query?.id === "string" ? req.query.id.trim() : "";
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      if (Object.prototype.hasOwnProperty.call(body, "className")) {
        return res.status(400).json({ ok: false, error: "أُعيدت الفصول إلى ٦/١ و٦/٢؛ تعديل الفصل متوقف" });
      }
      const studentName = typeof body.studentName === "string" ? body.studentName.replace(/\s+/g, " ").trim() : "";
      if (!id || studentName.length < 3 || studentName.length > 100) {
        return res.status(400).json({ ok: false, error: "أدخل اسم الطالب الصحيح (٣ إلى ١٠٠ حرف)" });
      }

      const updated = await sql`
        UPDATE lesson_progress
        SET student_name = ${studentName}, updated_at = now()
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
    console.error("Neon progress request failed", err?.code || "", err?.message || "unknown error");
    const missingUrl = err?.code === "DATABASE_URL_MISSING";
    return res.status(missingUrl ? 503 : 500).json({
      ok: false,
      code: missingUrl ? "DATABASE_URL_MISSING" : "NEON_REQUEST_FAILED",
      error: missingUrl
        ? "متغير DATABASE_URL غير موجود في إعدادات Vercel لهذا النشر. اربط قاعدة Neon ببيئة Production ثم أعد النشر."
        : "تعذر قراءة قاعدة Neon. تحقق من اتصال DATABASE_URL بقاعدة الإنتاج السابقة وراجع سجلات Functions في Vercel.",
    });
  }
}

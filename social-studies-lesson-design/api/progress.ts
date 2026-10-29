import { neon } from "@neondatabase/serverless";

/**
 * واجهة برمجية واحدة لإدارة تقدم الطلاب.
 * متغير البيئة المطلوب على Vercel:  DATABASE_URL  (رابط Neon)
 * اختياري: TEACHER_PIN (رمز دخول لوحة المعلم، الافتراضي 1234)
 */

/**
 * قراءة رابط قاعدة البيانات.
 * نفضّل DATABASE_URL_UNPOOLED (أسرع مع HTTP) ثم DATABASE_URL.
 * كلاهما يشير إلى نفس قاعدة Neon، فأيٌّ منهما يكفي.
 */
function getDatabaseUrl(): string | null {
  // ترتيب الأولوية: متغيرات Neon ← متغيرات Vercel Postgres/SQL ← متغيرات عامة
  const candidates = [
    process.env.DATABASE_URL_UNPOOLED,
    process.env.DATABASE_URL,
    process.env.NEON_DATABASE_URL,
    // Vercel Postgres / marketplace (السجل المشترك)
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_UNPOOLED,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_DATABASE_URL,
    process.env.SALAH_DATABASE_URL,
  ];
  for (const c of candidates) {
    if (c && c.trim() && !c.includes("YOUR_") && !c.includes("xxxx")) return c.trim();
  }
  return null;
}

const sqlClient = () => {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "لا يوجد متغير بيئة لقاعدة البيانات. المطلوب واحد من: DATABASE_URL أو DATABASE_URL_UNPOOLED " +
      "أو POSTGRES_URL (Vercel Postgres) — أضفه في Vercel ثم أعد النشر"
    );
  }
  return neon(url);
};

async function ensureTable(sql: any) {
  // ١) إنشاء الجداول أولاً (إن لم تكن موجودة)
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
  await sql`
    CREATE TABLE IF NOT EXISTS teacher_names (
      id           TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      class_name   TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // ٢) توحيد أسماء الفصول على الصيغة الأساسية (٦/١ و ٦/٢)
  //    لا يمس أي حقل آخر: التقدّم والدرجات والأنشطة تبقى كما هي.
  //    ملاحظة مهمة: لا نستخدم sql.unsafe هنا لأن إدراجه داخل tagged template
  //    ينتج جملة SQL ناقصة. نستخدم أسماء الجداول مكتوبة مباشرة.
  const OLD_A = ["٦ / أ", "6 / أ", "6/أ", "6/1", "6 / 1", "٦ / ١", "أ"];
  const OLD_B = ["٦ / ب", "6 / ب", "6/ب", "6/2", "6 / 2", "٦ / ٢", "ب"];

  try {
    await sql`
      UPDATE lesson_progress SET class_name = '٦/١' WHERE class_name = ANY(${OLD_A})
    `;
    await sql`
      UPDATE lesson_progress SET class_name = '٦/٢' WHERE class_name = ANY(${OLD_B})
    `;
    await sql`
      UPDATE teacher_names SET class_name = '٦/١' WHERE class_name = ANY(${OLD_A})
    `;
    await sql`
      UPDATE teacher_names SET class_name = '٦/٢' WHERE class_name = ANY(${OLD_B})
    `;
  } catch (e: any) {
    // الترحيل ثانوي — نتجاهله حتى لا تتعطل بقية Functions
    console.warn("class migration skipped:", e?.message);
  }
}

/** يمنع إنشاء الجداول والترحيل في كل طلب (أداء + استايل) */
let ready: Promise<void> | null = null;

function ensureReady(sql: any): Promise<void> {
  if (!ready) {
    ready = ensureTable(sql).catch((e) => {
      ready = null; // نسمح بإعادة المحاولة في الطلب التالي
      throw e;
    });
  }
  return ready;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const sql = sqlClient();
    try {
      await ensureReady(sql);
    } catch (e: any) {
      // إنشاء الجداول ثانوي — نكمل العملية (قد تكون الجداول موجودة مسبقاً)
      console.warn("ensureTable:", e?.message);
    }

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

      // لا نكتب في teacher_names هنا إطلاقاً.
      // هذا الجدول يُملأ فقط عبر PATCH (تعديل المعلم) — فأي رفع من الطالب
      // لا يستطيع أن يغيّر الاسم أو الفصل المعتمد من المعلم.
      // كما لا يُنشأ سجل جديد هنا، فيبقى الجدول نظيفاً ببيانات المعلم فقط.

      await sql`
        INSERT INTO lesson_progress
          (id, student_name, class_name, lesson_slug, max_slide, total_slides, quiz_score, quiz_total, activities, updated_at)
        VALUES
          (${id}, ${studentName}, ${className}, ${lessonSlug}, ${maxSlide}, ${totalSlides},
           ${quizScore}, ${quizTotal}, ${JSON.stringify(activities)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET
          student_name = COALESCE(
            (SELECT tn.student_name FROM teacher_names tn WHERE tn.id = lesson_progress.id),
            EXCLUDED.student_name
          ),
          class_name   = COALESCE(
            (SELECT tn.class_name FROM teacher_names tn WHERE tn.id = lesson_progress.id),
            EXCLUDED.class_name
          ),
          max_slide    = GREATEST(lesson_progress.max_slide, EXCLUDED.max_slide),
          total_slides = EXCLUDED.total_slides,
          quiz_score   = GREATEST(
            COALESCE(EXCLUDED.quiz_score, lesson_progress.quiz_score),
            COALESCE(lesson_progress.quiz_score, 0)
          ),
          quiz_total   = COALESCE(EXCLUDED.quiz_total, lesson_progress.quiz_total),
          activities   = lesson_progress.activities || EXCLUDED.activities,
          updated_at   = now();
      `;
      return res.status(200).json({ ok: true });
    }

    /* ===== تعديل اسم الطالب / فصله (للمعلم) — مع الحفاظ على كل البيانات ===== */
    if (req.method === "PATCH") {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ ok: false, error: "المعرف مطلوب" });
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { studentName, className } = body;
      if (!studentName || !String(studentName).trim()) {
        return res.status(400).json({ ok: false, error: "الاسم مطلوب" });
      }
      // تسجيل الاسم المعتمد من المعلم (يبقى محفوظاً رغم أي رفع لاحق من الطالب)
      await sql`
        INSERT INTO teacher_names (id, student_name, class_name, updated_at)
        VALUES (${id}, ${String(studentName).trim()}, ${className ?? null}, now())
        ON CONFLICT (id) DO UPDATE SET
          student_name = EXCLUDED.student_name,
          class_name   = COALESCE(EXCLUDED.class_name, teacher_names.class_name),
          updated_at   = now();
      `;

      // لا نغيّر أي حقل آخر: التقدم والدرجات والأنشطة تبقى كما هي
      const rows = await sql`
        UPDATE lesson_progress
        SET student_name = ${String(studentName).trim()},
            class_name   = COALESCE(${className ?? null}, class_name),
            updated_at   = now()
        WHERE id = ${id}
        RETURNING id, student_name, class_name, max_slide, quiz_score, quiz_total, activities, updated_at;
      `;
      if (!rows.length) return res.status(404).json({ ok: false, error: "السجل غير موجود" });
      return res.status(200).json({ ok: true, student: rows[0] });
    }

    /* ===== حذف سجل أو كل السجلات (للمعلم) ===== */
    if (req.method === "DELETE") {
      const id = req.query?.id;
      if (id) {
        await sql`DELETE FROM lesson_progress WHERE id = ${id}`;
        await sql`DELETE FROM teacher_names WHERE id = ${id}`;
      } else {
        await sql`DELETE FROM lesson_progress WHERE lesson_slug = 'saudi-state-2'`;
        await sql`DELETE FROM teacher_names`;
      }
      return res.status(200).json({ ok: true });
    }

    /* ===== البحث عن طالب بالاسم (عند دخول الطالب) ===== */
    if (req.method === "GET" && req.query?.name) {
      const name = String(req.query.name);
      const cls = req.query.class ? String(req.query.class) : null;
      const rows = await sql`
        SELECT lp.id,
               COALESCE(tn.student_name, lp.student_name) AS student_name,
               COALESCE(tn.class_name, lp.class_name)   AS class_name,
               lp.max_slide, lp.total_slides,
               lp.quiz_score, lp.quiz_total, lp.activities, lp.started_at, lp.updated_at
        FROM lesson_progress lp
        LEFT JOIN teacher_names tn ON tn.id = lp.id
        WHERE lp.lesson_slug = 'saudi-state-2'
          AND COALESCE(tn.student_name, lp.student_name) = ${name}
          AND (${cls}::text IS NULL OR COALESCE(tn.class_name, lp.class_name) = ${cls})
        ORDER BY lp.updated_at DESC
        LIMIT 1;
      `;
      return res.status(200).json({ ok: true, students: rows });
    }

    /* ===== تشخيص الاتصال بقاعدة البيانات ===== */
    if (req.method === "GET" && req.query?.diagnose) {
      const url = getDatabaseUrl();
      const info: any = {
        hasUrl: !!url,
        urlPreview: url ? url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:••••@").slice(0, 60) : null,
        urlProtocol: url ? url.split(":")[0] : null,
        varsFound: {
          DATABASE_URL_UNPOOLED: !!process.env.DATABASE_URL_UNPOOLED,
          DATABASE_URL: !!process.env.DATABASE_URL,
          NEON_DATABASE_URL: !!process.env.NEON_DATABASE_URL,
          POSTGRES_URL: !!process.env.POSTGRES_URL,
          POSTGRES_URL_UNPOOLED: !!process.env.POSTGRES_URL_UNPOOLED,
          POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
          POSTGRES_DATABASE_URL: !!process.env.POSTGRES_DATABASE_URL,
          SALAH_DATABASE_URL: !!process.env.SALAH_DATABASE_URL,
        },
      };
      try {
        const t0 = Date.now();
        const r = await sql`SELECT COUNT(*)::int AS count FROM lesson_progress`;
        info.queryOk = true;
        info.ms = Date.now() - t0;
        info.count = r?.[0]?.count ?? 0;
        const c = await sql`SELECT COUNT(*)::int AS count FROM teacher_names`;
        info.teacherNames = c?.[0]?.count ?? 0;
        const byClass = await sql`
          SELECT class_name, COUNT(*)::int AS count FROM lesson_progress
          GROUP BY class_name ORDER BY class_name
        `;
        info.byClass = byClass;
      } catch (e: any) {
        info.queryOk = false;
        info.error = e?.message || String(e);
      }
      return res.status(200).json(info);
    }

    /* ===== جلب كل سجلات الطلاب (لوحة المعلم) ===== */
    const rows = await sql`
      SELECT lp.id,
             COALESCE(tn.student_name, lp.student_name) AS student_name,
             COALESCE(tn.class_name, lp.class_name)   AS class_name,
             lp.max_slide, lp.total_slides,
             lp.quiz_score, lp.quiz_total, lp.activities, lp.started_at, lp.updated_at
      FROM lesson_progress lp
      LEFT JOIN teacher_names tn ON tn.id = lp.id
      WHERE lp.lesson_slug = 'saudi-state-2'
      ORDER BY lp.updated_at DESC
      LIMIT 500;
    `;
    return res.status(200).json({ ok: true, students: rows });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "خطأ في الخادم" });
  }
}

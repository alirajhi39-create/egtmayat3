import { neon } from "@neondatabase/serverless";

/**
 * تخزين الأصوات المخصصة في Neon لتُتاح على جميع الأجهزة.
 * GET    /api/sounds            → قائمة المفاتيح المرفوعة
 * GET    /api/sounds?key=xxx     → ملف صوتي (binary)
 * POST   /api/sounds?key=xxx     → رفع ملف (raw body) + x-file-name header
 * DELETE /api/sounds?key=xxx     → حذف ملف
 *
 * ملاحظة: حد حجم الطلب في Vercel هو ٤.٥ ميجابايت، لذا نسمح بحد أقصى ٤ ميجابايت.
 */

export const MAX_SOUND_BYTES = 4 * 1024 * 1024;

/** قراءة رابط قاعدة البيانات — نفضّل UNPOOLED ثم العادي */
function getDatabaseUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL_UNPOOLED,
    process.env.DATABASE_URL,
    process.env.NEON_DATABASE_URL,
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
  if (!url) throw new Error("لا يوجد متغير بيئة لقاعدة البيانات (DATABASE_URL أو DATABASE_URL_UNPOOLED أو POSTGRES_URL)");
  return neon(url);
};

async function ensureTable(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS lesson_sounds (
      key        TEXT PRIMARY KEY,
      mime       TEXT NOT NULL DEFAULT 'audio/mpeg',
      file_name  TEXT,
      size       INT  NOT NULL DEFAULT 0,
      data       BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

function toBuffer(value: any): Buffer {
  if (!value) return Buffer.alloc(0);
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  if (typeof value === "string") {
    // Neon قد يرجع bytea كسلسلة hex بصيغة \\x...
    if (value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
    return Buffer.from(value, "base64");
  }
  return Buffer.alloc(0);
}

function safeName(v: string | undefined) {
  const raw = v ? decodeURIComponent(v) : "";
  return raw.replace(/[^\p{L}\p{N}\s._-]/gu, "").slice(0, 120);
}

/** قراءة الجسم الخام سواءً مرّره Vercel كـ Buffer أو كتدفق */
async function readRaw(req: any): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (req.body && typeof req.body === "object") {
    if (req.body.data) return toBuffer(req.body.data);
    if (req.body instanceof Uint8Array) return Buffer.from(req.body);
  }
  return await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks));
    };
    req.on?.("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    req.on?.("end", finish);
    req.on?.("error", finish);
    setTimeout(finish, 15000);
  });
}

/** لا نُنشئ الجدول في كل طلب */
let ready: Promise<void> | null = null;
function ensureReady(sql: any): Promise<void> {
  if (!ready) {
    ready = ensureTable(sql).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-File-Name");
  if (req.method === "OPTIONS") return res.status(200).end();

  const key: string | undefined = req.query?.key ? String(req.query.key) : undefined;

  try {
    const sql = sqlClient();
    try {
      await ensureReady(sql);
    } catch (e: any) {
      console.warn("ensureTable:", e?.message);
    }

    /* ========= رفع ملف ========= */
    if (req.method === "POST") {
      if (!key) return res.status(400).json({ ok: false, error: "المفتاح مطلوب" });

      const buf = await readRaw(req);

      if (!buf.length) return res.status(400).json({ ok: false, error: "الملف فارغ أو لم يُقرأ" });
      if (buf.length > MAX_SOUND_BYTES) {
        return res.status(413).json({
          ok: false,
          error: "حجم الملف أكبر من ٤ ميجابايت. اضغط الملف الصوتي ثم أعد المحاولة.",
        });
      }

      const mime = String(req.headers["content-type"] || "audio/mpeg").split(";")[0];
      const fileName = safeName(req.headers["x-file-name"]) || `${key}.mp3`;

      const saved = await sql`
        INSERT INTO lesson_sounds (key, mime, file_name, size, data, updated_at)
        VALUES (${key}, ${mime}, ${fileName}, ${buf.length}, ${buf}, now())
        ON CONFLICT (key) DO UPDATE SET
          mime = EXCLUDED.mime,
          file_name = EXCLUDED.file_name,
          size = EXCLUDED.size,
          data = EXCLUDED.data,
          updated_at = now()
        RETURNING updated_at;
      `;
      return res.status(200).json({
        ok: true,
        key,
        size: buf.length,
        mime,
        updatedAt: saved?.[0]?.updated_at || new Date().toISOString(),
      });
    }

    /* ========= حذف ملف ========= */
    if (req.method === "DELETE") {
      if (!key) return res.status(400).json({ ok: false, error: "المفتاح مطلوب" });
      await sql`DELETE FROM lesson_sounds WHERE key = ${key}`;
      return res.status(200).json({ ok: true });
    }

    /* ========= إرجاع ملف محدد ========= */
    if (key) {
      const rows = await sql`
        SELECT mime, data, size, updated_at FROM lesson_sounds WHERE key = ${key} LIMIT 1
      `;
      if (!rows.length) return res.status(404).json({ ok: false, error: "غير موجود" });

      const buf = toBuffer(rows[0].data);
      const mime = rows[0].mime || "audio/mpeg";
      const version = String(rows[0].updated_at || "1");
      const etag = `"${key}-${version}"`;

      // دعم Conditional Request لتسريع تكرار التشغيل
      if (req.headers["if-none-match"] === etag) {
        res.setHeader("ETag", etag);
        return res.status(304).end();
      }

      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Length", String(buf.length));
      res.setHeader("Accept-Ranges", "none");
      res.setHeader("ETag", etag);
      res.setHeader(
        "Cache-Control",
        "public, max-age=604800, stale-while-revalidate=86400"
      );
      return res.status(200).send(buf);
    }

    /* ========= قائمة المفاتيح ========= */
    const rows = await sql`
      SELECT key, mime, file_name, size, updated_at
      FROM lesson_sounds
      ORDER BY updated_at DESC
      LIMIT 500;
    `;
    return res.status(200).json({
      ok: true,
      maxBytes: MAX_SOUND_BYTES,
      sounds: rows.map((r: any) => ({
        key: r.key,
        mime: r.mime,
        fileName: r.file_name,
        size: r.size,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "خطأ في الخادم" });
  }
}

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

const sqlClient = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير معرّف");
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

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-File-Name");
  if (req.method === "OPTIONS") return res.status(200).end();

  const key: string | undefined = req.query?.key ? String(req.query.key) : undefined;

  try {
    const sql = sqlClient();

    /* ========= رفع ملف ========= */
    if (req.method === "POST") {
      if (!key) return res.status(400).json({ ok: false, error: "المفتاح مطلوب" });
      // يُنشأ الجدول عند أول رفع فقط؛ القراءات اللاحقة لا تحتاج استعلام إنشاء.
      await ensureTable(sql);

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
      const rows = await sql`SELECT mime, data FROM lesson_sounds WHERE key = ${key} LIMIT 1`;
      if (!rows.length) return res.status(404).json({ ok: false, error: "غير موجود" });
      const buf = toBuffer(rows[0].data);
      res.setHeader("Content-Type", rows[0].mime || "audio/mpeg");
      res.setHeader("Accept-Ranges", "bytes");

      // يختلف الرابط بعد استبدال الملف (v=updatedAt)، فتُخزَّن النسخة الجديدة مستقلة.
      if (req.query?.v) {
        res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, immutable");
      } else {
        res.setHeader("Cache-Control", "no-store");
      }

      // بعض متصفحات الجوال تتطلب 206 لتشغيل الصوت مباشرة من الشبكة.
      const range = String(req.headers.range || "");
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (range && !match) {
        res.setHeader("Content-Range", `bytes */${buf.length}`);
        return res.status(416).end();
      }
      if (match) {
        const start = match[1] ? Number(match[1]) : Math.max(0, buf.length - Number(match[2]));
        const end = match[1] ? (match[2] ? Number(match[2]) : buf.length - 1) : buf.length - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= buf.length || end < start) {
          res.setHeader("Content-Range", `bytes */${buf.length}`);
          return res.status(416).end();
        }
        const chunk = buf.subarray(start, Math.min(end, buf.length - 1) + 1);
        res.setHeader("Content-Range", `bytes ${start}-${start + chunk.length - 1}/${buf.length}`);
        res.setHeader("Content-Length", String(chunk.length));
        return res.status(206).send(chunk);
      }

      res.setHeader("Content-Length", String(buf.length));
      return res.status(200).send(buf);
    }

    /* ========= قائمة المفاتيح ========= */
    const rows = await sql`
      SELECT key, mime, file_name, size, updated_at
      FROM lesson_sounds
      ORDER BY updated_at DESC
      LIMIT 500;
    `;
    res.setHeader("Cache-Control", "no-store");
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
    // قبل رفع أول ملف لا يوجد جدول بعد؛ الواجهة ترى قائمة فارغة بدلاً من خطأ.
    if (err?.code === "42P01") {
      if (key && req.method !== "DELETE") return res.status(404).json({ ok: false, error: "غير موجود" });
      if (req.method === "DELETE") return res.status(200).json({ ok: true });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, maxBytes: MAX_SOUND_BYTES, sounds: [] });
    }
    return res.status(500).json({ ok: false, error: err?.message || "خطأ في الخادم" });
  }
}

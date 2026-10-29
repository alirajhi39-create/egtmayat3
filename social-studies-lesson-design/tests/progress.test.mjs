import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

test("teacher edits name and class without losing legacy student progress", async () => {
  process.env.DATABASE_URL = "postgresql://example.invalid/test";
  const row = {
    id: "existing-student", student_name: "الاسم القديم", class_name: "٦/١",
    lesson_slug: "saudi-state-2", max_slide: 6, total_slides: 14,
    quiz_score: 7, quiz_total: 8, activities: { "نشاط١": "إجابة سابقة" },
    started_at: "2025-01-01T10:00:00Z", updated_at: "2025-01-02T10:00:00Z",
  };
  globalThis.__progressRow = row;
  globalThis.__progressQueries = [];

  const result = await build({
    entryPoints: ["api/progress.ts"], bundle: true, platform: "node", format: "esm", write: false,
    plugins: [{
      name: "fake-neon",
      setup(builder) {
        builder.onResolve({ filter: /^@neondatabase\/serverless$/ }, () => ({ path: "neon", namespace: "fake" }));
        builder.onLoad({ filter: /.*/, namespace: "fake" }, () => ({
          contents: `export const neon = () => async (strings, ...values) => {
            const query = strings.join("?");
            const row = globalThis.__progressRow;
            globalThis.__progressQueries.push(query);
            if (query.includes("CREATE TABLE")) return [];
            if (query.includes("SET class_name = CASE")) {
              if (row.class_name === "٦/١") row.class_name = "6 / أ";
              return [];
            }
            if (query.includes("UPDATE lesson_progress")) {
              if (values[2] !== row.id) return [];
              if (values[0] !== null) row.student_name = values[0];
              if (values[1] !== null) row.class_name = values[1];
              return [{ student_name: row.student_name, class_name: row.class_name }];
            }
            if (query.includes("INSERT INTO lesson_progress")) {
              if (query.includes("ON CONFLICT (id) DO NOTHING")) return [];
              if (values[0] !== row.id) throw new Error("unexpected student");
              row.max_slide = Math.max(row.max_slide, values[4]);
              row.activities = { ...row.activities, ...JSON.parse(values[8]) };
              return [{ student_name: row.student_name, class_name: row.class_name }];
            }
            if (query.includes("SELECT student_name, class_name FROM lesson_progress")) {
              return values[0] === row.id ? [{ student_name: row.student_name, class_name: row.class_name }] : [];
            }
            if (query.includes("SELECT id, student_name")) return [row];
            throw new Error("Unexpected SQL: " + query);
          };`,
          loader: "js",
        }));
      },
    }],
  });
  const source = Buffer.from(result.outputFiles[0].text).toString("base64");
  const { default: handler } = await import(`data:text/javascript;base64,${source}`);
  const response = () => ({
    headers: {}, code: 200,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  });

  const renamed = response();
  await handler({ method: "PATCH", query: { id: row.id }, body: { studentName: "  الاسم   الجديد  " } }, renamed);
  assert.equal(renamed.code, 200);
  assert.equal(renamed.body.studentName, "الاسم الجديد");
  assert.equal(renamed.body.className, "6 / أ");
  assert.equal(row.id, "existing-student");
  assert.equal(row.quiz_score, 7);
  assert.deepEqual(row.activities, { "نشاط١": "إجابة سابقة" });

  const movedClass = response();
  await handler({ method: "PATCH", query: { id: row.id }, body: { className: "6 / ب" } }, movedClass);
  assert.equal(movedClass.code, 200);
  assert.equal(movedClass.body.studentName, "الاسم الجديد");
  assert.equal(movedClass.body.className, "6 / ب");
  assert.equal(row.class_name, "6 / ب");
  assert.equal(row.quiz_score, 7);

  const oldClient = response();
  await handler({ method: "POST", query: {}, body: {
    id: row.id, studentName: "الاسم القديم", className: "٦/١", maxSlide: 9,
    activities: { "نشاط٢": "إجابة جديدة" },
  } }, oldClient);
  assert.equal(oldClient.code, 200);
  assert.equal(oldClient.body.studentName, "الاسم الجديد");
  assert.equal(oldClient.body.className, "6 / ب");
  assert.equal(row.class_name, "6 / ب");
  assert.equal(row.max_slide, 9);
  assert.equal(row.quiz_score, 7);
  assert.deepEqual(row.activities, { "نشاط١": "إجابة سابقة", "نشاط٢": "إجابة جديدة" });
  assert.equal(row.started_at, "2025-01-01T10:00:00Z");
  const migration = globalThis.__progressQueries.find((query) => query.includes("SET class_name = CASE"));
  assert.ok(migration && !migration.includes("updated_at"), "legacy class migration must not change historical timestamps");
  assert.ok(!globalThis.__progressQueries.some((query) => query.includes("student_name = EXCLUDED.student_name")));
  assert.ok(!globalThis.__progressQueries.some((query) => query.includes("class_name   = EXCLUDED.class_name")));
  assert.ok(!globalThis.__progressQueries.some((query) => /DELETE FROM|DROP TABLE|TRUNCATE/.test(query)));

  const restoreExisting = response();
  await handler({ method: "POST", query: { restore: "1" }, body: {
    id: row.id, studentName: "نسخة أقدم", className: "٦/١", maxSlide: 1,
    quizScore: 0, activities: { "نشاط١": "إجابة قديمة" },
  } }, restoreExisting);
  assert.equal(restoreExisting.body.created, false);
  assert.equal(row.student_name, "الاسم الجديد");
  assert.equal(row.class_name, "6 / ب");
  assert.equal(row.max_slide, 9);
  assert.equal(row.quiz_score, 7);
  assert.equal(row.activities["نشاط١"], "إجابة سابقة");

  const listing = response();
  await handler({ method: "GET", query: {} }, listing);
  assert.equal(listing.body.students[0].student_name, "الاسم الجديد");
  assert.equal(listing.body.students[0].class_name, "6 / ب");
  const currentName = response();
  await handler({ method: "GET", query: { id: row.id } }, currentName);
  assert.equal(currentName.body.studentName, "الاسم الجديد");
  assert.equal(currentName.body.className, "6 / ب");

  const invalidClass = response();
  await handler({ method: "PATCH", query: { id: row.id }, body: { className: "6 / ج" } }, invalidClass);
  assert.equal(invalidClass.code, 400);
  assert.equal(row.class_name, "6 / ب");
});

test("backup restores only missing IDs and updates the student session name", async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); },
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.Event = class { constructor(type) { this.type = type; } };

  const result = await build({ entryPoints: ["src/lib/progress.ts"], bundle: true, platform: "browser", format: "esm", write: false });
  const source = Buffer.from(result.outputFiles[0].text).toString("base64");
  const progress = await import(`data:text/javascript;base64,${source}`);
  const existing = {
    id: "remote", studentName: "طالب قديم", className: "٦/١", maxSlide: 8,
    totalSlides: 14, quizScore: 6, quizTotal: 8, activities: { "نشاط١": "محفوظ" },
    startedAt: "2025-01-01T10:00:00Z", updatedAt: "2025-01-02T10:00:00Z",
  };
  const local = { ...existing, id: "local", studentName: "طالب محلي" };
  localStorage.setItem("lesson2_local_students", JSON.stringify([local]));
  const backup = progress.parseBackup(progress.makeBackup([existing]));
  assert.deepEqual(backup.map((student) => student.id), ["remote", "local"]);
  assert.equal(backup[0].className, "6 / أ");

  const posted = [];
  globalThis.fetch = async (_url, options) => {
    const student = JSON.parse(options.body);
    posted.push(student);
    return { ok: true, json: async () => ({ ok: true, created: true }) };
  };
  const restored = await progress.restoreMissingStudents([...backup, local], ["remote"]);
  assert.deepEqual(restored, { restored: 1, skipped: 0, failed: 0 });
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0].activities, { "نشاط١": "محفوظ" });

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, studentName: "الاسم الذي عدله المعلم", className: "6 / ب" }) });
  const session = progress.createSession("اسم الطالب الأول", "٦/١", 14);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(progress.getSession().id, session.id);
  assert.equal(progress.getSession().studentName, "الاسم الذي عدله المعلم");
  assert.equal(progress.getSession().className, "6 / ب");
  assert.equal(progress.getSession().maxSlide, session.maxSlide);

  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, "PATCH");
    return { ok: true, json: async () => ({ ok: true, studentName: "اسم جديد من اللوحة", className: "6 / أ" }) };
  };
  await progress.updateStudentDetails(session.id, { studentName: "اسم جديد من اللوحة", className: "6 / أ" });
  assert.equal(progress.getSession().studentName, "اسم جديد من اللوحة");
  assert.equal(progress.getSession().className, "6 / أ");
  assert.equal(progress.getSession().id, session.id);
  assert.equal(progress.readLocal().find((student) => student.id === session.id).studentName, "اسم جديد من اللوحة");
  assert.equal(progress.readLocal().find((student) => student.id === session.id).className, "6 / أ");

  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: "تعذر الحفظ" }) });
  await assert.rejects(progress.updateStudentDetails(session.id, { className: "6 / ب" }), /تعذر الحفظ/);
  assert.equal(progress.getSession().studentName, "اسم جديد من اللوحة");
  assert.equal(progress.getSession().className, "6 / أ");
});

test("old sixth-grade class labels normalize to the new options", async () => {
  const result = await build({ entryPoints: ["src/lib/classes.ts"], bundle: true, platform: "browser", format: "esm", write: false });
  const source = Buffer.from(result.outputFiles[0].text).toString("base64");
  const { CLASSES, normalizeClassName, isClassName } = await import(`data:text/javascript;base64,${source}`);
  assert.deepEqual(CLASSES, ["6 / أ", "6 / ب"]);
  assert.equal(normalizeClassName("٦/١"), "6 / أ");
  assert.equal(normalizeClassName("٦ / ٢"), "6 / ب");
  assert.equal(normalizeClassName("6/1"), "6 / أ");
  assert.equal(normalizeClassName("6 / ب"), "6 / ب");
  assert.equal(isClassName("6 / ج"), false);
});
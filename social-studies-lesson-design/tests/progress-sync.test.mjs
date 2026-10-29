import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

test("student work retries to Neon after connection returns", async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); },
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.Event = class { constructor(type) { this.type = type; } };

  const result = await build({
    entryPoints: ["src/lib/progress.ts"], bundle: true, platform: "browser", format: "esm", write: false,
  });
  const source = Buffer.from(result.outputFiles[0].text).toString("base64");
  const progress = await import(`data:text/javascript;base64,${source}`);

  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: false, status: 503 };
  };
  const session = progress.createSession("طالب مع إجابة", "٦/١", 14);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(progress.online, false);
  assert.equal(localStorage.getItem(`lesson2_pending_${session.id}`), "1");

  progress.recordActivity("نشاط١", "الإجابة المحفوظة محلياً");
  assert.equal(progress.getSession().activities["نشاط١"], "الإجابة المحفوظة محلياً");

  let sent;
  globalThis.fetch = async (_url, options) => {
    calls++;
    sent = JSON.parse(options.body);
    return { ok: true, json: async () => ({ ok: true, studentName: sent.studentName, className: "٦/١" }) };
  };
  await progress.syncSessionProgress();
  assert.equal(calls, 2);
  assert.equal(progress.online, true);
  assert.equal(sent.id, session.id);
  assert.equal(sent.activities["نشاط١"], "الإجابة المحفوظة محلياً");
  assert.equal(localStorage.getItem(`lesson2_pending_${session.id}`), null);

  await progress.syncSessionProgress();
  assert.equal(calls, 2, "synced work must not send duplicate requests every 30 seconds");
});
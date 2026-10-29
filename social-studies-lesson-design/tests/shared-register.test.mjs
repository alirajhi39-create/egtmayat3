import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";

test("shared register only reports Neon when the API is actually connected", async () => {
  const compiled = await build({
    entryPoints: ["src/components/SharedRegister.tsx"],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["react"],
    write: false,
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const { SharedRegister } = module.exports;
  const base = { loading: false, classFilter: "٦/١", count: 12, onRefresh() {}, onSelectClass() {} };

  const connected = renderToStaticMarkup(createElement(SharedRegister, { ...base, connected: true, error: null }));
  assert.match(connected, /السجل المشترك متصل/);
  assert.match(connected, /PostgreSQL \(Neon\)/);
  assert.match(connected, /٦\/١/);
  assert.match(connected, /12 في السجل/);

  const offline = renderToStaticMarkup(createElement(SharedRegister, { ...base, connected: false, error: "تعذر الوصول إلى Neon" }));
  assert.match(offline, /السجل المشترك غير متصل/);
  assert.match(offline, /تعذر الوصول إلى Neon/);
  assert.doesNotMatch(offline, /PostgreSQL \(Neon\)/);
  assert.match(offline, /12 على هذا الجهاز/);
});
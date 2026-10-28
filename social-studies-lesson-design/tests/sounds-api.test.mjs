import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

test("sound API supports mobile byte ranges and versioned CDN caching", async () => {
  process.env.DATABASE_URL = "postgresql://example.invalid/test";
  globalThis.__soundQueries = [];
  const result = await build({
    entryPoints: ["api/sounds.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [{
      name: "fake-neon",
      setup(builder) {
        builder.onResolve({ filter: /^@neondatabase\/serverless$/ }, () => ({ path: "neon", namespace: "fake" }));
        builder.onLoad({ filter: /.*/, namespace: "fake" }, () => ({
          contents: `export const neon = () => async (strings) => {
            const query = strings.join("?");
            globalThis.__soundQueries.push(query);
            if (query.includes("SELECT mime, data")) {
              return [{ mime: "audio/mpeg", data: new Uint8Array([1, 2, 3, 4, 5, 6]) }];
            }
            if (query.includes("SELECT key, mime")) return [];
            return [];
          };`,
          loader: "js",
        }));
      },
    }],
  });
  const source = Buffer.from(result.outputFiles[0].text).toString("base64");
  const { default: handler } = await import(`data:text/javascript;base64,${source}`);

  const response = () => ({
    headers: {},
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.code = code; return this; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  });

  const partial = response();
  await handler({ method: "GET", query: { key: "voice-slide-0", v: "v2" }, headers: { range: "bytes=2-4" } }, partial);
  assert.equal(partial.code, 206);
  assert.equal(partial.headers["Content-Range"], "bytes 2-4/6");
  assert.deepEqual([...partial.body], [3, 4, 5]);
  assert.match(partial.headers["Cache-Control"], /s-maxage=86400/);

  const full = response();
  await handler({ method: "GET", query: { key: "voice-slide-0" }, headers: {} }, full);
  assert.equal(full.code, 200);
  assert.equal(full.headers["Cache-Control"], "no-store");
  assert.equal(full.headers["Content-Length"], "6");

  const invalid = response();
  await handler({ method: "GET", query: { key: "voice-slide-0" }, headers: { range: "bytes=20-" } }, invalid);
  assert.equal(invalid.code, 416);

  const listing = response();
  await handler({ method: "GET", query: {}, headers: {} }, listing);
  assert.equal(listing.code, 200);
  assert.deepEqual(listing.body.sounds, []);
  assert.ok(globalThis.__soundQueries.every((q) => !q.includes("CREATE TABLE")), "GET must not create the table on every play");
});
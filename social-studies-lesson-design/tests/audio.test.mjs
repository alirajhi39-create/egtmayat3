import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

test("cloud audio starts immediately and only one sound remains active", async () => {
  const players = [];
  const tones = [];
  let mediaFetches = 0;
  let spoken = 0;

  class FakeAudio {
    constructor() {
      this.src = "";
      this.paused = false;
      players.push(this);
    }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ""; }
    load() {}
  }
  class FakeOscillator {
    constructor() {
      this.frequency = { setValueAtTime() {} };
      this.stopped = false;
      tones.push(this);
    }
    connect() {}
    disconnect() {}
    start() {}
    stop() { this.stopped = true; this.onended?.(); }
  }

  globalThis.Audio = FakeAudio;
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) { this.text = text; }
  };
  globalThis.window = {
    speechSynthesis: {
      cancel() {},
      getVoices() { return []; },
      speak() { spoken++; },
    },
    AudioContext: class {
      state = "running";
      currentTime = 0;
      createOscillator() { return new FakeOscillator(); }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
    },
  };
  globalThis.fetch = async (url) => {
    if (url === "/api/sounds") {
      return {
        ok: true,
        json: async () => ({
          sounds: ["voice-slide-0", "voice-slide-1", "sfx-flip"].map((key) => ({
            key,
            updatedAt: "2026-01-01T12:00:00Z",
          })),
        }),
      };
    }
    mediaFetches++;
    throw new Error("Full media downloads should not block playback");
  };

  const result = await build({
    stdin: {
      contents: 'export * as audio from "./src/utils/audio.ts"; export * as store from "./src/utils/soundStore.ts";',
      resolveDir: process.cwd(),
      sourcefile: "test-entry.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
  });
  const source = Buffer.from(result.outputFiles[0].text).toString("base64");
  const { audio, store } = await import(`data:text/javascript;base64,${source}`);
  await store.refreshKeys();

  let firstEnded = 0;
  let secondEnded = 0;
  audio.speak("first", () => firstEnded++, "voice-slide-0");
  assert.equal(players.length, 1);
  assert.match(players[0].src, /voice-slide-0/);
  assert.equal(mediaFetches, 0, "play should stream a URL without fetching the full file first");

  audio.speak("second", () => secondEnded++, "voice-slide-1");
  assert.equal(players[0].paused, true, "a new file should stop the previous one");
  assert.equal(firstEnded, 1);
  assert.equal(players.length, 2);

  audio.playFlip();
  assert.equal(players[1].paused, true, "a custom effect should stop narration");
  assert.equal(secondEnded, 1);
  assert.equal(players.length, 3);
  audio.playClick();
  assert.equal(players[2].paused, true, "a new effect should stop the custom file");
  assert.equal(tones.length, 2);
  audio.stopAllAudio();
  assert.ok(tones.every((tone) => tone.stopped), "navigation should stop Web Audio tones");

  audio.speak("fallback", undefined, "voice-slide-0");
  players.at(-1).onerror();
  assert.equal(spoken, 1, "a failed media stream should fall back to speech synthesis");
  audio.stopAllAudio();

  let rejectPlay;
  FakeAudio.prototype.play = () => new Promise((_, reject) => { rejectPlay = reject; });
  let cancelledEnded = 0;
  audio.speak("cancelled", () => cancelledEnded++, "voice-slide-0");
  audio.stopAllAudio();
  rejectPlay(new Error("download cancelled"));
  await Promise.resolve();
  assert.equal(cancelledEnded, 1, "a cancelled player must notify its button once");
  assert.equal(spoken, 1, "a cancelled media request must not start speech later");
});
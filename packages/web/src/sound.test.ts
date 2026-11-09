// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { playBlockedTone, playDoneTone, setSoundFiles } from "./sound";

const plays: string[] = [];
let failPlay = false;
class FakeAudio {
  listeners: Record<string, () => void> = {};
  constructor(public src: string) { plays.push(src); }
  addEventListener(name: string, fn: () => void) { this.listeners[name] = fn; }
  play() { return failPlay ? Promise.reject(new Error("blocked")) : Promise.resolve(); }
}
const tones: number[][] = [];
class FakeContext {
  state = "running";
  currentTime = 0;
  destination = {};
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { const osc = { type: "", frequency: { value: 0 }, connect() {}, start() { tones.push([osc.frequency.value]); }, stop() {} }; return osc; }
}
Object.assign(globalThis, { Audio: FakeAudio });
Object.assign(window, { AudioContext: FakeContext });

afterEach(() => { setSoundFiles(); plays.length = 0; tones.length = 0; failPlay = false; });

describe("notification sounds", () => {
  it("play the person's file when settings name one, else the built-in tone", () => {
    playDoneTone();
    expect(plays).toEqual([]);
    expect(tones.length).toBeGreaterThan(0);
    tones.length = 0;
    setSoundFiles("sounds/ding.mp3", "");
    playDoneTone();
    expect(plays).toHaveLength(1);
    expect(new URL(plays[0]!).searchParams.get("sound")).toBe("sounds/ding.mp3");
    expect(new URL(plays[0]!).pathname).toMatch(/mods\/file$/);
    expect(tones).toEqual([]);
    playBlockedTone(); // blocked has no file of its own: the tone
    expect(plays).toHaveLength(1);
    expect(tones.length).toBeGreaterThan(0);
  });

  it("fall back to the tone when the file will not play", async () => {
    setSoundFiles("", "missing.wav");
    failPlay = true;
    playBlockedTone();
    await Promise.resolve();
    await Promise.resolve();
    expect(plays).toHaveLength(1);
    expect(tones.length).toBeGreaterThan(0);
  });
});

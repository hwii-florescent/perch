/**
 * sound.ts — Wave 1 item 3: minimal WebAudio-generated notification tones.
 *
 * No binary assets in the repo (per the design doc) — both tones are plain
 * oscillator blips. A single shared `AudioContext` is created lazily (on the
 * first `playTone` call) since browsers refuse to start one before a user
 * gesture; by the time a session finishes a turn the user has certainly
 * already interacted with the page (typed/clicked), so this is never
 * actually blocked in practice.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") {
    // Best-effort resume; ignored if the browser still refuses (no gesture
    // yet) — the tone will simply be silent that one time.
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

function playTone(freqs: number[], durationMs: number): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  gain.connect(audio.destination);

  freqs.forEach((freq, i) => {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    const start = now + i * (durationMs / 1000 / freqs.length);
    osc.start(start);
    osc.stop(now + durationMs / 1000 + 0.05);
  });
}

/** Session finished a turn while unseen — two short ascending notes. */
export function playDoneTone(): void {
  playTone([660, 880], 260);
}

/** Session became blocked on an approval prompt — a single lower, more
 * insistent note (distinct timbre from "done" so they aren't confused). */
export function playBlockedTone(): void {
  playTone([440, 440], 320);
}

import { describe, it, expect } from "vitest";
import { parseOsc52, OSC52_MAX_DECODED_BYTES } from "./osc52";

// btoa/atob only understand one-byte-per-char binary strings, so UTF-8 text
// must be encoded to bytes first, then those bytes threaded through as
// binary-string chars. Chunked to avoid blowing the call stack via
// `String.fromCharCode(...bytes)` on the larger payloads these tests build.
function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

describe("parseOsc52", () => {
  it("parses an explicit c target as a write", () => {
    const result = parseOsc52(`c;${b64("hello")}`);
    expect(result).toEqual({ kind: "write", text: "hello" });
  });

  it("treats an empty target as the system clipboard (spec default)", () => {
    const result = parseOsc52(`;${b64("hello")}`);
    expect(result).toEqual({ kind: "write", text: "hello" });
  });

  it("reports a ? payload as a read request without decoding it", () => {
    expect(parseOsc52("c;?")).toEqual({ kind: "read-ignored" });
  });

  it("rejects unsupported targets: p (primary selection)", () => {
    expect(parseOsc52(`p;${b64("x")}`)).toEqual({ kind: "unsupported-target" });
  });

  it("rejects unsupported targets: s (secondary selection)", () => {
    expect(parseOsc52(`s;${b64("x")}`)).toEqual({ kind: "unsupported-target" });
  });

  it.each(["0", "1", "2", "3", "4", "5", "6", "7"])(
    "rejects unsupported target: cut buffer %s",
    (target) => {
      expect(parseOsc52(`${target};${b64("x")}`)).toEqual({ kind: "unsupported-target" });
    },
  );

  it("still honours c even when combined with other target chars", () => {
    // xterm allows multiple target chars in one sequence, e.g. "cp" means
    // "both clipboard and primary" — we only act on the clipboard part.
    expect(parseOsc52(`cp;${b64("hi")}`)).toEqual({ kind: "write", text: "hi" });
  });

  it("returns invalid for input with no separator at all", () => {
    expect(parseOsc52("nosemicolonhere")).toEqual({ kind: "invalid" });
  });

  it("returns invalid for an empty string", () => {
    expect(parseOsc52("")).toEqual({ kind: "invalid" });
  });

  it("returns invalid for non-base64 payload", () => {
    const result = parseOsc52("c;not valid base64!!!");
    expect(result.kind).toBe("invalid");
  });

  it("rejects an oversized payload before decoding (pre-decode length guard)", () => {
    // Construct a base64 string whose *encoded* length alone already exceeds
    // the guard, independent of what it would decode to.
    const oversizedEncodedLength = Math.ceil((OSC52_MAX_DECODED_BYTES * 4) / 3) + 100;
    const payload = "A".repeat(oversizedEncodedLength);
    expect(parseOsc52(`c;${payload}`)).toEqual({ kind: "too-large" });
  });

  it("rejects a payload that passes the pre-decode guard but decodes over the byte cap", () => {
    // Build valid base64 that decodes to just over OSC52_MAX_DECODED_BYTES,
    // encoded length also just at/under the pre-decode ceiling so it must
    // be caught by the *post-decode* check, not the length guard.
    const big = "x".repeat(OSC52_MAX_DECODED_BYTES + 1);
    const payload = b64(big);
    expect(payload.length).toBeLessThanOrEqual(Math.ceil((OSC52_MAX_DECODED_BYTES * 4) / 3) + 4);
    expect(parseOsc52(`c;${payload}`)).toEqual({ kind: "too-large" });
  });

  it("accepts a payload right at the decoded byte cap", () => {
    const exact = "x".repeat(OSC52_MAX_DECODED_BYTES);
    const result = parseOsc52(`c;${b64(exact)}`);
    expect(result).toEqual({ kind: "write", text: exact });
  });

  it("round-trips multi-byte UTF-8 text without mangling it", () => {
    // atob() returns a binary string (one JS char per *byte*, not per
    // codepoint); a naive `text = binary` would produce mojibake for any
    // character whose UTF-8 encoding is >1 byte. This is the exact bug
    // class Phase 12.1 hit in the PTY reader.
    const text = "héllo 世界 🎉 café";
    const result = parseOsc52(`c;${b64(text)}`);
    expect(result).toEqual({ kind: "write", text });
  });

  it("round-trips emoji requiring surrogate pairs", () => {
    const text = "🚀🔥✅";
    const result = parseOsc52(`c;${b64(text)}`);
    expect(result).toEqual({ kind: "write", text });
  });
});

/**
 * osc52.ts — pure parsing for OSC 52 clipboard-write sequences
 * (`ESC ] 52 ; <targets> ; <payload> ST`), split out of `xtermSetup.ts` so it
 * is testable without a DOM/xterm instance.
 *
 * We only ever *write* to the system clipboard from this sequence, never
 * read it. A payload of `?` is a read request (the program is asking perch
 * to hand it the current clipboard contents) — the browser Clipboard API
 * can't satisfy that without a permission prompt per call, and honouring it
 * silently would let any program running in the pane (including remote/agent
 * output) exfiltrate whatever the user last copied. So a read request is
 * parsed and reported, but the caller must not act on it.
 */

/** Hard cap on the decoded payload size. A misbehaving program could emit a
 * huge OSC 52 (e.g. `cat` of a large file into a yank-to-clipboard mapping);
 * without a cap that becomes an unbounded base64 decode plus a giant
 * `writeText` call on every keystroke of output. 1 MiB decoded is far more
 * than any real yank/copy needs and is cheap to allocate. */
export const OSC52_MAX_DECODED_BYTES = 1024 * 1024;

export type Osc52ParseResult =
  | { kind: "write"; text: string }
  | { kind: "read-ignored" }
  | { kind: "unsupported-target" }
  | { kind: "too-large" }
  | { kind: "invalid" };

/**
 * Parse an OSC 52 payload (everything after `52;`, i.e. `<targets>;<data>`).
 *
 * `targets` selects which clipboard-like buffer(s) the program means: `c`
 * (system clipboard), `p`/`s` (primary/secondary X11 selections, meaningless
 * outside X11), `0`-`7` (cut buffers, legacy X10). Per the xterm spec an
 * empty targets string means `c`. We only support forwarding to the one
 * clipboard the browser exposes — `navigator.clipboard` — so:
 *   - empty or containing `c` → treat as a clipboard write
 *   - anything else (only p/s/0-7) → unsupported, ignored rather than
 *     guessed at (writing a primary-selection yank to the system clipboard
 *     would be silently wrong, not silently right)
 */
export function parseOsc52(data: string): Osc52ParseResult {
  const separator = data.indexOf(";");
  if (separator === -1) return { kind: "invalid" };
  const targets = data.slice(0, separator);
  const payload = data.slice(separator + 1);

  if (payload === "?") return { kind: "read-ignored" };

  const wantsClipboard = targets === "" || targets.includes("c");
  if (!wantsClipboard) return { kind: "unsupported-target" };

  if (payload.length > Math.ceil((OSC52_MAX_DECODED_BYTES * 4) / 3) + 4) {
    return { kind: "too-large" };
  }

  let text: string;
  try {
    const binary = atob(payload);
    if (binary.length > OSC52_MAX_DECODED_BYTES) return { kind: "too-large" };
    // OSC 52 payloads are UTF-8 text base64-encoded; atob gives us a binary
    // string (one byte per char), so re-decode it as UTF-8 rather than
    // treating those bytes as the final characters.
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return { kind: "invalid" };
  }
  return { kind: "write", text };
}

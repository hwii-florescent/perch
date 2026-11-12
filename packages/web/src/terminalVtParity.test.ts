// @vitest-environment jsdom
//
// The same stress output in the two emulators a Perch session can be shown by: the native client's
// Ghostty-based `Vt`, and the xterm.js the web and phone clients run (built by `createPerchTerminal`).
// `crates/perch-native/tests/vt_xterm_fixtures.rs` feeds each recorded stream to `Vt` directly and
// again as the repaint perchd sends on attach, and writes what `Vt` held into the fixture file (it
// fails when the file goes stale). Here the stream and the repaint go through xterm.js and its buffer
// is compared cell by cell: text, width, foreground and background colour, and the style flags.
//
// Four comparisons per case:
//   attach     native, fed the stream     vs xterm.js, fed the repaint
//   stream     native, fed the stream     vs xterm.js, fed the stream
//   replayed   native, fed the repaint    vs xterm.js, fed the repaint
//   repaint    native, fed the stream     vs native, fed the repaint (no xterm.js)
//
// Differences are expected where the engines legitimately differ (character width rules, hidden
// text, blink, how a wide character at the last column wraps). They are pinned in KNOWN below so a
// change in either engine is noticed; the counts are what was observed, not a goal. Colours compare
// after resolving the palette: an xterm.js palette entry 0-15 is read through the native theme's
// palette, so a theme choice is not counted as a rendering difference (the themes are listed by
// the last test). Set PERCH_PARITY_REPORT=<file> to write every difference as JSON.
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IBufferCell, Terminal } from "@xterm/xterm";
import fixtures from "./terminalVtParity.fixtures.json";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  addEventListener(): void {}
  removeEventListener(): void {}
  send(): void {}
  close(): void {}
}
(globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;

interface NativeGrid {
  alternate: boolean;
  defaultFg: string;
  defaultBg: string;
  cursor: [number, number] | null;
  history: number;
  rows: { c: string; a: [number, string, string, number][] }[];
  images: { col: number; row: number; width: number; height: number }[];
}
interface Fixture {
  name: string;
  cols: number;
  rows: number;
  stream: string;
  repaint: string;
  native: { stream: NativeGrid; repaint: NativeGrid | null };
}
const { palette16, cases } = fixtures as unknown as { palette16: string[]; cases: Fixture[] };

/** One cell in a form both engines can be reduced to. */
interface Cell {
  text: string;
  /** "DF"/"DB": the theme's default foreground/background (what inverse swaps), else rrggbb; "" for a blank. */
  fg: string;
  /** "" the default background, "DF" the default foreground (inverse), else rrggbb. */
  bg: string;
  /** 1 bold, 2 italic, 4 faint, 8 underline, 16 strike; 32 blink and 64 overline only xterm.js reports. */
  flags: number;
}
interface Grid {
  alternate: boolean;
  cursor: [number, number] | null;
  /** Images placed on the screen; xterm.js here has no image support. */
  images: number;
  rows: Cell[][];
}
const BLANK: Cell = { text: " ", fg: "", bg: "", flags: 0 };

/** A colour as a token: the theme's own default colours are "DF"/"DB" however a program spelled them. */
const tokenOf = (grid: NativeGrid) => (hex: string, fgSide: boolean) =>
  hex === grid.defaultFg ? "DF" : hex === grid.defaultBg ? (fgSide ? "DB" : "") : hex;

function fromNative(grid: NativeGrid): Grid {
  const token = tokenOf(grid);
  const rows = grid.rows.map((row) => {
    const cells: Cell[] = [];
    let run = 0;
    (row.c === "" ? [] : row.c.split("\ue000")).forEach((text, x) => {
      while (run + 1 < row.a.length && row.a[run + 1][0] <= x) run++;
      const [, fg, bg, flags] = row.a[run];
      cells.push({ text, fg: text === " " ? "" : token(fg, true), bg: bg ? token(bg, false) : "", flags });
    });
    return cells;
  });
  return { alternate: grid.alternate, cursor: grid.cursor, images: grid.images.length, rows };
}

const hex6 = (n: number) => n.toString(16).padStart(6, "0");
const LEVELS = [0, 95, 135, 175, 215, 255];
function paletteHex(n: number): string {
  if (n < 16) return palette16[n];
  if (n < 232) {
    const i = n - 16;
    const [r, g, b] = [Math.floor(i / 36), Math.floor(i / 6) % 6, i % 6].map((v) => LEVELS[v]);
    return hex6((r << 16) | (g << 8) | b);
  }
  const v = 8 + 10 * (n - 232);
  return hex6((v << 16) | (v << 8) | v);
}

function fromXterm(term: Terminal, native: NativeGrid): Grid {
  const token = tokenOf(native);
  const buffer = term.buffer.active;
  const rows: Cell[][] = [];
  const reuse = buffer.getNullCell();
  for (let y = 0; y < buffer.length; y++) {
    const line = buffer.getLine(y);
    const cells: Cell[] = [];
    for (let x = 0; line && x < term.cols; x++) {
      const cell: IBufferCell = line.getCell(x, reuse) as IBufferCell;
      const chars = cell.getChars();
      const text = cell.getWidth() === 0 ? "" : chars === "" ? " " : chars;
      const colour = (isDefault: boolean, isRgb: boolean, value: number, def: string) =>
        isDefault ? def : isRgb ? hex6(value) : paletteHex(value);
      let fg = token(colour(cell.isFgDefault(), cell.isFgRGB(), cell.getFgColor(), native.defaultFg), true);
      let bg = token(colour(cell.isBgDefault(), cell.isBgRGB(), cell.getBgColor(), native.defaultBg), false);
      if (cell.isInverse()) [fg, bg] = [bg === "" ? "DB" : bg, fg === "DB" ? "" : fg];
      cells.push({
        text,
        fg: text === " " ? "" : fg,
        bg,
        flags:
          (cell.isBold() ? 1 : 0) | (cell.isItalic() ? 2 : 0) | (cell.isDim() ? 4 : 0) |
          (cell.isUnderline() ? 8 : 0) | (cell.isStrikethrough() ? 16 : 0) |
          // The native cell has no such attribute, so these always show as a difference.
          (cell.isBlink() ? 32 : 0) | (cell.isOverline() ? 64 : 0),
      });
    }
    rows.push(cells);
  }
  // A cursor after the last column is "pending wrap" to xterm.js as column `cols`, and the last column to Ghostty.
  return { alternate: buffer.type === "alternate", images: 0, cursor: [buffer.cursorY, Math.min(buffer.cursorX, term.cols - 1)], rows };
}

/** A terminal view at the fixture's size, fed the parts in order (the way terminalRepaint.test.ts does). */
async function view(fixture: Fixture, native: NativeGrid, ...parts: string[]) {
  const context = new Proxy({ measureText: () => ({ width: 8 }) } as Record<string, unknown>, {
    get: (target, key: string) => target[key] ?? (() => {}),
  });
  HTMLCanvasElement.prototype.getContext = (() => context) as never;
  window.matchMedia ??= (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never;
  globalThis.ResizeObserver ??= class { observe() {} disconnect() {} } as never;
  globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} } as never;
  const { createPerchTerminal } = await import("./xtermSetup");
  const { term, dispose } = createPerchTerminal(document.createElement("div"), () => {});
  term.resize(fixture.cols, fixture.rows);
  for (const part of parts) await new Promise<void>((done) => term.write(part, done));
  const grid = fromXterm(term, native);
  dispose();
  return grid;
}

interface Difference {
  kind: "text" | "fg" | "bg" | "flags" | "rows" | "alternate" | "cursor" | "images";
  y?: number;
  x?: number;
  native: unknown;
  other: unknown;
}

/** Bottom-aligned, as a viewer sees them: the rows below the last one are the same rows. */
function compare(native: Grid, other: Grid): Difference[] {
  const out: Difference[] = [];
  if (native.alternate !== other.alternate) out.push({ kind: "alternate", native: native.alternate, other: other.alternate });
  if (native.images !== other.images) out.push({ kind: "images", native: native.images, other: other.images });
  if (native.rows.length !== other.rows.length) out.push({ kind: "rows", native: native.rows.length, other: other.rows.length });
  if (native.cursor && other.cursor && (native.cursor[0] !== other.cursor[0] || native.cursor[1] !== other.cursor[1])) {
    out.push({ kind: "cursor", native: native.cursor, other: other.cursor });
  }
  const count = Math.min(native.rows.length, other.rows.length);
  for (let i = 1; i <= count; i++) {
    const a = native.rows[native.rows.length - i];
    const b = other.rows[other.rows.length - i];
    const y = native.rows.length - i;
    for (let x = 0; x < Math.max(a.length, b.length); x++) {
      const p = a[x] ?? BLANK;
      const q = b[x] ?? BLANK;
      if (p.text !== q.text) out.push({ kind: "text", y, x, native: p.text, other: q.text });
      else if (p.text !== "" && p.text !== " " && p.fg !== q.fg) out.push({ kind: "fg", y, x, native: p.fg, other: q.fg });
      if (p.bg !== q.bg) out.push({ kind: "bg", y, x, native: p.bg, other: q.bg });
      if (p.flags !== q.flags) out.push({ kind: "flags", y, x, native: p.flags, other: q.flags });
    }
  }
  return out;
}

const tally = (found: Difference[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const d of found) counts[d.kind] = (counts[d.kind] ?? 0) + 1;
  return counts;
};

/**
 * What differs, per "<comparison>/<case>"; absent means identical. Each entry is a real difference:
 * - cjk_and_emoji, text: a flag (two regional indicators) is two wide cells in Ghostty and two narrow ones
 *   in xterm.js; with the stream (not the repaint) a keycap keeps U+FE0F in xterm.js and loses it in Ghostty.
 * - colours_and_styles, text: hidden text (SGR 8) is blank in Ghostty and kept, flagged invisible, by xterm.js.
 * - colours_and_styles, flags: blink (SGR 5) and overline (SGR 53) exist in xterm.js and not in the native cell.
 * - alternate_screen_tui, bg: perchd's repaint paints the blank cells after a run of background colour with
 *   that colour too (the original left them default), so a client that attaches shows a longer bar. It is in
 *   the bytes, so xterm.js shows it as well; "repaint" is native against native and sees it without xterm.js.
 * - kitty_image, images: the native client holds the image placement; the repaint carries none and xterm.js
 *   here has no image support.
 */
const KNOWN: Record<string, Record<string, number>> = {
  "attach/alternate_screen_tui": { bg: 21 },
  "attach/cjk_and_emoji": { text: 12 },
  "attach/colours_and_styles": { flags: 13, text: 6 },
  "attach/kitty_image": { images: 1 },
  "repaint/alternate_screen_tui": { bg: 21 },
  "repaint/kitty_image": { images: 1 },
  "replayed/cjk_and_emoji": { text: 12 },
  "replayed/colours_and_styles": { flags: 13, text: 6 },
  "stream/cjk_and_emoji": { text: 14 },
  "stream/colours_and_styles": { flags: 13, text: 6 },
  "stream/kitty_image": { images: 1 },
};

describe("the native Vt and xterm.js on the same output", () => {
  const found: Record<string, Difference[]> = {};

  it("compares every case four ways", async () => {
    for (const fixture of cases) {
      const native = fromNative(fixture.native.stream);
      const replayed = fromNative(fixture.native.repaint ?? fixture.native.stream);
      const fromStream = await view(fixture, fixture.native.stream, fixture.stream);
      const fromRepaint = await view(fixture, fixture.native.stream, fixture.repaint);
      found[`attach/${fixture.name}`] = compare(native, fromRepaint);
      found[`stream/${fixture.name}`] = compare(native, fromStream);
      found[`replayed/${fixture.name}`] = compare(replayed, fromRepaint);
      found[`repaint/${fixture.name}`] = compare(native, replayed);
    }
    if (process.env.PERCH_PARITY_REPORT) {
      const report = Object.fromEntries(Object.entries(found).map(([key, list]) => [key, { counts: tally(list), first: list.slice(0, 12) }]));
      writeFileSync(process.env.PERCH_PARITY_REPORT, JSON.stringify(report, null, 1));
    }
    const observed = Object.fromEntries(Object.entries(found).map(([key, list]) => [key, tally(list)]).filter(([, counts]) => Object.keys(counts as object).length > 0));
    expect(observed).toEqual(KNOWN);
  }, 120_000);

  it("uses the same palette and default colours, so a colour difference is never a theme choice", () => {
    // xterm.js's own defaults, which createPerchTerminal falls back to when the profile names no theme.
    const xtermAnsi = ["2e3436", "cc0000", "4e9a06", "c4a000", "3465a4", "75507b", "06989a", "d3d7cf", "555753", "ef2929", "8ae234", "fce94f", "729fcf", "ad7fa8", "34e2e2", "eeeeec"];
    expect(palette16).toEqual(xtermAnsi);
    const { defaultFg, defaultBg } = cases[0].native.stream;
    expect([defaultFg, defaultBg]).toEqual(["ffffff", "000000"]);
  });
});

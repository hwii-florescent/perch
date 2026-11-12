// @vitest-environment jsdom
//
// What a client sees after a default attach to perchd: the replayed byte tail,
// then the repaint `perchd::screen` builds from Ghostty's engine. The bytes
// are fixtures written by the Rust test
// `crates/perchd/tests/repaint_fixtures.rs` (which fails when they go stale),
// next to what Ghostty's screen held when it produced them. Here they go
// through the xterm.js that the web and phone clients run, built by
// `createPerchTerminal` like a real terminal view, and its buffer is compared
// with that screen. jsdom stubs what xterm only needs to measure and observe.
import { describe, expect, it } from "vitest";
import type { Terminal } from "@xterm/xterm";
import fixtures from "./terminalRepaint.fixtures.json";

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

interface Fixture {
  name: string;
  cols: number;
  rows: number;
  tail: string;
  repaint: string;
  expect: {
    alternate: boolean;
    cursor: [number, number];
    scrollbackRows: number;
    visible: string[];
    modes: Record<string, boolean>;
    extra: { lines?: number; long?: string; logical?: string[] };
  };
}

const byName = (name: string): Fixture => {
  const found = (fixtures as unknown as Fixture[]).find((fixture) => fixture.name === name);
  if (!found) throw new Error(`no fixture named ${name}`);
  return found;
};

/** A terminal view at the fixture's size, fed each part in order. */
async function view(fixture: Fixture, ...parts: string[]) {
  // Writes are awaited here, so xterm's animation-frame work runs: every canvas call has to exist.
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
  return { term, dispose };
}

// A printed trailing space (a prompt's "$ ") is a cell xterm keeps and Ghostty's text drops.
const rowText = (term: Terminal, y: number, normal = false): string =>
  ((normal ? term.buffer.normal : term.buffer.active).getLine(y)?.translateToString(true) ?? "").trimEnd();

/** Row `y` of the screen, counted from the top of what is on screen rather than of the history. */
const screenRow = (term: Terminal, y: number): string => rowText(term, term.buffer.active.baseY + y);

/** Every row of the normal buffer, history first. */
const normalRows = (term: Terminal): string[] =>
  Array.from({ length: term.buffer.normal.length }, (_, y) => rowText(term, y, true));

/** The visible rows of the active buffer must read as Ghostty's screen does, and the modes and cursor must agree. */
function expectScreenOf(term: Terminal, fixture: Fixture, rows = true) {
  const { expect: want } = fixture;
  expect(term.buffer.active.type).toBe(want.alternate ? "alternate" : "normal");
  if (rows) {
    const shown = Array.from({ length: fixture.rows }, (_, y) => screenRow(term, y));
    const wanted = Array.from({ length: fixture.rows }, (_, y) => want.visible[y] ?? "");
    expect(shown).toEqual(wanted);
  }
  expect([term.buffer.active.cursorY, term.buffer.active.cursorX]).toEqual(want.cursor);
  const on = (mode: number) => want.modes[String(mode)] === true;
  expect(term.modes.mouseTrackingMode).toBe(on(1003) ? "any" : on(1002) ? "drag" : on(1000) ? "vt200" : "none");
  expect(term.modes.bracketedPasteMode).toBe(on(2004));
  expect(term.modes.sendFocusMode).toBe(on(1004));
  expect(term.modes.applicationCursorKeysMode).toBe(on(1));
  expect(term.modes.wraparoundMode).toBe(on(7));
}

describe("a default attach into xterm.js", () => {
  it("shows an alternate-screen TUI long after it painted, from the repaint alone", async () => {
    const fixture = byName("alternate_screen_tui");
    // The tail is only status-row redraws: the header and prompt are in the repaint or nowhere.
    expect(fixture.tail).not.toContain("HEADER");
    const { term, dispose } = await view(fixture, fixture.tail, fixture.repaint);
    expectScreenOf(term, fixture);
    expect(screenRow(term, 0)).toBe("HEADER");
    expect(screenRow(term, 19)).toBe("> prompt");
    expect(screenRow(term, 29)).toBe("status 19999");
    // Nothing of it reached the normal buffer, and leaving the alternate screen shows an empty shell screen.
    expect(normalRows(term).filter((row) => row !== "")).toEqual([]);
    dispose();
  });

  it("keeps scrollback beyond one screen reachable in the buffer", async () => {
    const fixture = byName("scrollback");
    const { term, dispose } = await view(fixture, fixture.tail, fixture.repaint);
    expectScreenOf(term, fixture);
    const lines = fixture.expect.extra.lines as number;
    expect(term.buffer.normal.length).toBe(fixture.expect.scrollbackRows + fixture.rows);
    expect(term.buffer.normal.length).toBeGreaterThan(fixture.rows * 10);
    for (let line = 0; line < lines; line++) expect(rowText(term, line, true)).toBe(`line ${line} colour`);
    expect(rowText(term, lines, true)).toBe("$");
    dispose();
  });

  it("turns mouse reporting, bracketed paste, focus events and cursor keys on, whatever was set before", async () => {
    const fixture = byName("input_modes");
    // A view that had been in another app: any-event mouse, no autowrap, and an alternate screen of its own.
    const { term, dispose } = await view(fixture, "\x1b[?1049h\x1b[?1003h\x1b[?7l\x1b[?2004l", fixture.tail, fixture.repaint);
    expectScreenOf(term, fixture);
    expect(term.modes.mouseTrackingMode).toBe("vt200");
    expect(term.modes.bracketedPasteMode).toBe(true);
    expect(term.modes.sendFocusMode).toBe(true);
    expect(term.modes.applicationCursorKeysMode).toBe(true);
    expect(term.modes.wraparoundMode).toBe(true);
    expect(screenRow(term, 0)).toBe("menu");
    dispose();
  });

  it("marks the continuation rows of a soft-wrapped line as wrapped, so a wider view rejoins it", async () => {
    const fixture = byName("soft_wrapped_lines");
    const { long, logical } = fixture.expect.extra as { long: string; logical: string[] };
    const { term, dispose } = await view(fixture, fixture.tail, fixture.repaint);
    // Ghostty's visible text joins wrapped rows; xterm's buffer rows are checked by their wrap flags below.
    expectScreenOf(term, fixture, false);

    // Rows chained by their wrap flags read as the lines the app printed, in scrollback and on screen.
    const buffer = term.buffer.normal;
    const joined: string[] = [];
    for (let y = 0; y < buffer.length; y++) {
      const text = (buffer.getLine(y)?.translateToString(true) ?? "").trimEnd();
      if (buffer.getLine(y)?.isWrapped && joined.length) joined[joined.length - 1] += text;
      else joined.push(text);
    }
    while (joined.at(-1) === "") joined.pop();
    expect(joined).toEqual(logical);
    const wrappedRows = Array.from({ length: buffer.length }, (_, y) => buffer.getLine(y)?.isWrapped ?? false).filter(Boolean);
    expect(wrappedRows).toHaveLength(2 * Math.ceil(long.length / fixture.cols - 1));

    // And xterm's own reflow does the rest.
    term.resize(120, fixture.rows);
    const rows = normalRows(term);
    expect(rows.filter((row) => row === long)).toHaveLength(2);
    expect(rows.some((row) => long.startsWith(row) && row !== long && row.length > 0 && row.length < long.length)).toBe(false);
    dispose();
  });

  it("wraps a wide character that does not fit the last column the way Ghostty did", async () => {
    const fixture = byName("wide_character_at_a_wrap");
    const { term, dispose } = await view(fixture, fixture.tail, fixture.repaint);
    expectScreenOf(term, fixture, false);
    const buffer = term.buffer.normal;
    expect(buffer.getLine(1)?.isWrapped).toBe(true);
    expect([rowText(term, 0, true), rowText(term, 1, true), rowText(term, 2, true)]).toEqual(["123456789", "世界abc", "after"]);
    term.resize(40, fixture.rows);
    expect(rowText(term, 0, true)).toBe("123456789世界abc");
    expect(rowText(term, 1, true)).toBe("after");
    dispose();
  });

  it("keeps a combining mark and a VS16 symbol where Ghostty put them", async () => {
    const fixture = byName("grapheme_clusters");
    const { term, dispose } = await view(fixture, fixture.tail, fixture.repaint);
    expectScreenOf(term, fixture);
    dispose();
  });

  it("leaves no duplicate scrollback when the replayed tail comes before the repaint", async () => {
    const fixture = byName("scrollback");
    const alone = await view(fixture, fixture.repaint);
    const both = await view(fixture, fixture.tail, fixture.repaint);
    // The tail repeats lines the repaint's history already holds; the reset must have dropped them.
    expect(fixture.tail).toContain("line 499 ");
    expect(normalRows(both.term)).toEqual(normalRows(alone.term));
    const rows = normalRows(both.term);
    expect(rows.filter((row) => row === "line 499 colour")).toHaveLength(1);
    expect(rows.filter((row) => row === "line 400 colour")).toHaveLength(1);
    expect(rows).toHaveLength(fixture.expect.scrollbackRows + fixture.rows);
    alone.dispose();
    both.dispose();
  });
});

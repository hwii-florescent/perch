// @vitest-environment jsdom
import { Terminal } from "@xterm/xterm";
import { expect, it } from "vitest";
import { attachCommandMarks, parseSemanticPrompt } from "./commandMarks";

const OSC = (data: string) => `\x1b]133;${data}\x07`;
const write = (term: Terminal, data: string) => new Promise<void>((resolve) => term.write(data, resolve));

it("parses only the semantic-prompt kinds it understands", () => {
  expect(parseSemanticPrompt("A")).toEqual({ kind: "A" });
  expect(parseSemanticPrompt("D;2")).toEqual({ kind: "D", exit: 2 });
  expect(parseSemanticPrompt("D")).toEqual({ kind: "D" });
  expect(parseSemanticPrompt("D;abc")).toEqual({ kind: "D" });
  expect(parseSemanticPrompt("Z;1")).toBeNull();
});

it("marks commands from the real parser, hides the escapes, and jumps between them", async () => {
  const term = new Terminal({ cols: 20, rows: 5, scrollback: 100, allowProposedApi: true });
  const marks = attachCommandMarks(term, () => "#ff0000");
  // Three commands: ok, failed, and one with no D yet; each has enough output to scroll.
  let out = "";
  for (const [n, code] of [[1, 0], [2, 3], [3, undefined]] as const) {
    out += `${OSC("A")}$ cmd${n}\r\n${OSC("C")}`;
    for (let i = 0; i < 6; i++) out += `out${n}.${i}\r\n`;
    if (code !== undefined) out += OSC(`D;${code}`);
  }
  await write(term, out);
  expect(marks.marks.map((m) => [m.ran, m.exit])).toEqual([[true, 0], [true, 3], [true, undefined]]);
  expect(term.buffer.active.getLine(0)?.translateToString(true)).toBe("$ cmd1"); // escapes are not printed

  term.scrollToBottom();
  const lines = marks.marks.map((m) => m.marker.line);
  expect(marks.jump(-1)).toBe(true);
  expect(term.buffer.active.viewportY).toBe(lines[2]);
  expect(marks.jump(-1)).toBe(true);
  expect(term.buffer.active.viewportY).toBe(lines[1]);
  expect(marks.jump(1)).toBe(true);
  expect(marks.jump(1)).toBe(true); // past the newest command: back to the live bottom
  expect(term.buffer.active.viewportY).toBe(term.buffer.active.baseY);
  marks.dispose();
  expect(marks.marks).toEqual([]);
});

it("treats a bare Run (C then D, no prompt mark) as one command and does nothing without marks", async () => {
  const term = new Terminal({ cols: 20, rows: 5, allowProposedApi: true });
  const marks = attachCommandMarks(term);
  expect(marks.jump(-1)).toBe(false);
  await write(term, `${OSC("C")}hi\r\n${OSC("D;7")}\r\n[exit 7]\r\n`);
  expect(marks.marks.map((m) => [m.ran, m.exit])).toEqual([[true, 7]]);
  // A prompt that never ran a command is not something to jump to.
  const quiet = new Terminal({ cols: 20, rows: 5, allowProposedApi: true });
  const none = attachCommandMarks(quiet);
  await write(quiet, `${OSC("A")}$ \r\n`);
  expect(none.jump(-1)).toBe(false);
  term.dispose(); quiet.dispose();
});

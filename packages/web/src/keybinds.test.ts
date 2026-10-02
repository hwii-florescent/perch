// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Terminal } from "@xterm/xterm";
import { terminalKeyHandler } from "./keybinds";

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return { type: "keydown", key: "", code: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, preventDefault() {}, ...init } as KeyboardEvent;
}

describe("terminalKeyHandler", () => {
  it("keeps Ctrl+Space (the leader) away from the PTY and passes Enter variants to xterm", () => {
    expect(terminalKeyHandler(key({ key: " ", code: "Space", ctrlKey: true }))).toBe(false);
    expect(terminalKeyHandler(key({ key: "Enter", ctrlKey: true }))).toBe(true);
    expect(terminalKeyHandler(key({ key: "Enter", shiftKey: true }))).toBe(true);
  });
});

describe("kitty keyboard protocol", () => {
  it("sends plain \\r until a CLI opts in, then distinct Ctrl/Shift+Enter", async () => {
    // jsdom has no matchMedia or canvas; xterm only uses them to measure.
    HTMLCanvasElement.prototype.getContext = (() => ({ measureText: () => ({ width: 8 }) })) as never;
    window.matchMedia ??= (() => ({ matches: false, addListener() {}, removeListener() {} })) as never;
    const term = new Terminal({ vtExtensions: { kittyKeyboard: true } });
    term.open(document.createElement("div"));
    const sent: string[] = [];
    term.onData((d) => sent.push(d));
    const press = (init: KeyboardEventInit) =>
      term.textarea!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true, ...init } as KeyboardEventInit));

    press({ ctrlKey: true });
    await new Promise<void>((r) => term.write("\x1b[>1u", r)); // what claude/codex push at startup
    press({});
    press({ ctrlKey: true });
    press({ shiftKey: true });
    expect(sent).toEqual(["\r", "\r", "\x1b[13;5u", "\x1b[13;2u"]);
    term.dispose();
  });
});

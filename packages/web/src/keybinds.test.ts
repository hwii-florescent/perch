// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { terminalKeyHandler } from "./keybinds";

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return { type: "keydown", key: "", code: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, preventDefault() {}, ...init } as KeyboardEvent;
}

describe("terminalKeyHandler", () => {
  it("encodes Ctrl+Enter and Shift+Enter like Orca and passes plain Enter through", () => {
    const sent: string[] = [];
    const term = { input: (data: string) => sent.push(data) };
    expect(terminalKeyHandler(term, key({ key: "Enter", ctrlKey: true }))).toBe(false);
    expect(terminalKeyHandler(term, key({ key: "Enter", shiftKey: true }))).toBe(false);
    expect(terminalKeyHandler(term, key({ key: "Enter" }))).toBe(true);
    expect(terminalKeyHandler(term, key({ key: "Enter", ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(sent).toEqual(["\x1b[13;5u", "\x1b\r"]);
  });

  it("keeps Ctrl+Space (the leader) away from the PTY", () => {
    expect(terminalKeyHandler({ input() {} }, key({ key: " ", code: "Space", ctrlKey: true }))).toBe(false);
  });
});

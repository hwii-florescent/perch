// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { Terminal } from "@xterm/xterm";
import { KEYBINDS, SHORTCUTS, formatCombo, isShortcut, shortcutFor, terminalKeyHandler, useLeaderKey } from "./keybinds";

it("cancels the leader on keyup without swallowing ordinary Space or text input", async () => {
  let navigations = 0;
  function Leader() {
    useLeaderKey({ openNavigator() { navigations++; }, openKeybindHelp() {}, toggleDrawer() {} });
    return null;
  }
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => { root.render(createElement(Leader)); });
  try {
    const button = document.createElement("button");
    const input = document.createElement("input");
    host.append(button, input);
    const release = (target: HTMLElement, ctrlKey: boolean) => target.dispatchEvent(new KeyboardEvent("keyup", {
      key: " ", code: "Space", ctrlKey, bubbles: true, cancelable: true,
    }));
    expect(release(button, true)).toBe(false);
    expect(release(button, false)).toBe(true);
    expect(release(input, true)).toBe(true);
    const editor = document.createElement("textarea");
    editor.dataset.testid = "workspace-file-editor";
    host.append(editor);
    const press = (target: HTMLElement, key: string, ctrlKey = false) => target.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey, bubbles: true, cancelable: true }));
    expect(press(input, " ", true)).toBe(true); // forms still keep Ctrl+Space
    expect(press(editor, "?")).toBe(true); // ordinary editor text is untouched
    expect(press(editor, " ", true)).toBe(false);
    expect(release(editor, true)).toBe(false);
    expect(press(editor, "g")).toBe(false);
    expect(navigations).toBe(1);
    expect(press(editor, "n")).toBe(true); // no armed chord: normal typing
  } finally {
    await act(async () => { root.unmount(); });
    env.IS_REACT_ACT_ENVIRONMENT = previous;
    host.remove();
  }
});

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return { type: "keydown", key: "", code: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, preventDefault() {}, ...init } as KeyboardEvent;
}

describe("terminalKeyHandler", () => {
  it("keeps Ctrl+Space (the leader) away from the PTY and passes Enter variants to xterm", () => {
    expect(terminalKeyHandler(key({ key: " ", code: "Space", ctrlKey: true }))).toBe(false);
    expect(terminalKeyHandler(key({ key: "Enter", ctrlKey: true }))).toBe(true);
    expect(terminalKeyHandler(key({ key: "Enter", shiftKey: true }))).toBe(true);
  });

  it("keeps Cmd combinations (copy, paste, find) with the app", () => {
    expect(terminalKeyHandler(key({ key: "v", code: "KeyV", metaKey: true }))).toBe(false);
    expect(terminalKeyHandler(key({ type: "keyup", key: "c", code: "KeyC", metaKey: true }))).toBe(false);
    expect(terminalKeyHandler(key({ key: "k", code: "KeyK", ctrlKey: true }))).toBe(true);
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

describe("direct shortcuts", () => {
  it("maps mod to Cmd on a Mac and Ctrl+Shift elsewhere, matching modifiers exactly", () => {
    expect(isShortcut(key({ key: "t", code: "KeyT", metaKey: true }), "mod+t", true)).toBe(true);
    expect(isShortcut(key({ key: "t", code: "KeyT", metaKey: true, shiftKey: true }), "mod+t", true)).toBe(false);
    expect(isShortcut(key({ key: "T", code: "KeyT", ctrlKey: true, shiftKey: true }), "mod+t", false)).toBe(true);
    expect(isShortcut(key({ key: "t", code: "KeyT", ctrlKey: true }), "mod+t", false)).toBe(false); // plain Ctrl+T is the shell's
    expect(isShortcut(key({ key: "}", code: "BracketRight", metaKey: true, shiftKey: true }), "cmd+shift+]", true)).toBe(true);
  });

  it("formats combos for each platform", () => {
    expect(formatCombo("cmd+shift+]", true)).toBe("⇧⌘]");
    expect(formatCombo("ctrl+shift+up", true)).toBe("⌃⇧↑");
    expect(formatCombo("mod+t", false)).toBe("Ctrl+Shift+T");
  });

  it("never binds one key twice on a platform", () => {
    for (const mac of [true, false]) {
      const seen = new Map<string, string>();
      for (const s of SHORTCUTS) {
        const spec = s.keys[mac ? 0 : 1];
        if (spec === null) continue;
        const c = formatCombo(spec, mac);
        expect(seen.get(c), `${c} (${mac ? "mac" : "other"}) is bound to both "${seen.get(c)}" and "${s.description}"`).toBeUndefined();
        seen.set(c, s.description);
      }
    }
  });

  it("finds a shortcut by event and leaves plain Ctrl letters to the PTY", () => {
    const e = (init: Partial<KeyboardEvent>) => key({ ...init });
    expect(shortcutFor(e({ code: "ArrowDown", ctrlKey: true, shiftKey: true }), true)?.description).toBe("Next nest");
    expect(terminalKeyHandler(e({ code: "KeyC", key: "c", ctrlKey: true }))).toBe(true); // Ctrl+C reaches the shell
  });

  it("lists every non-hidden shortcut in the help", () => {
    expect(KEYBINDS.some((k) => k.description === "New nest (worktree)")).toBe(true);
    expect(KEYBINDS.some((k) => k.group === "leader")).toBe(true);
  });
});

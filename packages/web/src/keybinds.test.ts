// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { Terminal } from "@xterm/xterm";
import { SHORTCUTS, effectiveSpec, keybindEntries, shortcutsBoundTo, shortcutFor, terminalKeyHandler, useLeaderKey } from "./keybinds";
import { IS_MAC, comboMatches, formatCombo, normalizeCombo, parseCombo, recordCombo } from "./keyCombo";
import { usePerchStore } from "./store";

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
  const press = (init: Partial<KeyboardEvent>) => key({ type: "keydown", ...init });

  it("maps mod to Cmd on a Mac and Ctrl+Shift elsewhere, matching modifiers exactly", () => {
    const t = (e: KeyboardEvent, spec: string, mac: boolean) => comboMatches(e, parseCombo(spec, mac));
    expect(t(press({ key: "t", code: "KeyT", metaKey: true }), "mod+t", true)).toBe(true);
    expect(t(press({ key: "t", code: "KeyT", metaKey: true, shiftKey: true }), "mod+t", true)).toBe(false);
    expect(t(press({ key: "T", code: "KeyT", ctrlKey: true, shiftKey: true }), "mod+t", false)).toBe(true);
    expect(t(press({ key: "t", code: "KeyT", ctrlKey: true }), "mod+t", false)).toBe(false); // plain Ctrl+T is the shell's
    expect(t(press({ key: "}", code: "BracketRight", metaKey: true, shiftKey: true }), "cmd+shift+]", true)).toBe(true);
  });

  it("formats combos for each platform", () => {
    expect(formatCombo("cmd+shift+]", true)).toBe("⇧⌘]");
    expect(formatCombo("ctrl+shift+up", true)).toBe("⌃⇧↑");
    expect(formatCombo("mod+t", false)).toBe("Ctrl+Shift+T");
    expect(formatCombo("alt+f5", false)).toBe("Alt+F5");
  });

  it("never binds one key twice on a platform, and every default parses", () => {
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
    for (const mac of [true, false]) {
      for (const inTerm of [false, true]) { // Cmd+K is the Navigator outside a terminal and "clear" inside one
        const seen = new Map<string, string>();
        for (const s of SHORTCUTS.filter((x) => (inTerm ? x.scope !== "outsideTerminal" : x.scope !== "terminal"))) {
          const spec = s.keys[mac ? 0 : 1];
          if (spec === null) continue;
          const c = normalizeCombo(spec, mac);
          expect(seen.get(c), `${c} (${mac ? "mac" : "other"}) is bound to both "${seen.get(c)}" and "${s.description}"`).toBeUndefined();
          seen.set(c, s.description);
        }
      }
    }
  });

  it("follows the user's overrides: a new key, no key, and a conflicting key", () => {
    const withOverrides = (keybindings: Record<string, string>) => usePerchStore.setState({ settings: { keybindings } as never });
    const newTab = SHORTCUTS.find((s) => s.id === "tabs.new")!;
    const cmdT = press({ key: "t", code: "KeyT", metaKey: true });
    const cmdJ = press({ key: "j", code: "KeyJ", metaKey: true });
    withOverrides({});
    expect(shortcutFor(cmdT, false, true)?.id).toBe("tabs.new");
    withOverrides({ "tabs.new": "cmd+j" });
    expect(shortcutFor(cmdT, false, true)).toBeUndefined();
    expect(shortcutFor(cmdJ, false, true)?.id).toBe("tabs.new");
    expect(shortcutsBoundTo("cmd+j", "tabs.close", true).map((x) => x.id)).toEqual(["tabs.new"]);
    withOverrides({ "tabs.new": "" });
    expect(effectiveSpec(newTab, true)).toBeNull();
    expect(shortcutFor(cmdT, false, true)).toBeUndefined();
    withOverrides({ "tabs.new": "not+a+key" }); // a hand-edited file must not break the keymap
    expect(effectiveSpec(newTab, true)).toBeNull();
    withOverrides({});
  });

  it("leaves plain Ctrl letters to the PTY and lets Ctrl+K through outside terminals only", () => {
    usePerchStore.setState({ settings: { keybindings: {} } as never });
    expect(terminalKeyHandler(press({ code: "KeyC", key: "c", ctrlKey: true }))).toBe(true);
    const ctrlK = press({ code: "KeyK", key: "k", ctrlKey: true });
    expect(shortcutFor(ctrlK, false, false)?.id).toBe("global.navigatorAlt");
    expect(shortcutFor(ctrlK, true, false)).toBeUndefined();
    if (!IS_MAC) expect(terminalKeyHandler(ctrlK)).toBe(true); // Ctrl+K is the shell's inside a terminal
    expect(shortcutFor(press({ code: "KeyK", key: "k", metaKey: true }), true, true)?.id).toBe("terminal.clear");
    expect(shortcutFor(press({ code: "KeyK", key: "k", metaKey: true }), false, true)?.id).toBe("global.navigatorAlt");
  });

  it("lists shortcuts in the help and collapses an untouched range", () => {
    usePerchStore.setState({ settings: { keybindings: {} } as never });
    const entries = keybindEntries(true);
    expect(entries.filter((k) => k.description.startsWith("Jump to tab")).map((k) => k.keys)).toEqual(["⌘1…8"]);
    expect(entries.some((k) => k.description === "New nest (worktree)")).toBe(true);
    expect(entries.some((k) => k.group === "leader")).toBe(true);
    usePerchStore.setState({ settings: { keybindings: { "tabs.jump2": "cmd+alt+2" } } as never });
    expect(keybindEntries(true).filter((k) => /^Jump to tab \d$/.test(k.description))).toHaveLength(8);
    usePerchStore.setState({ settings: { keybindings: { "tabs.new": "" } } as never });
    expect(keybindEntries(true).some((k) => k.description.startsWith("New tab"))).toBe(false);
  });
});

describe("recordCombo", () => {
  it("turns a keydown into a spec, waits on bare modifiers and refuses plain keys", () => {
    const rec = (init: Partial<KeyboardEvent>) => recordCombo(key(init));
    expect(rec({ key: "Meta", code: "MetaLeft", metaKey: true })).toBeNull();
    expect(rec({ key: "t", code: "KeyT", metaKey: true, shiftKey: true })).toEqual({ spec: "cmd+shift+t" });
    expect(rec({ key: "ArrowUp", code: "ArrowUp", ctrlKey: true, shiftKey: true })).toEqual({ spec: "ctrl+shift+up" });
    expect(rec({ key: "}", code: "BracketRight", metaKey: true, shiftKey: true })).toEqual({ spec: "cmd+shift+]" });
    expect(rec({ key: "¬", code: "KeyL", altKey: true })).toEqual({ spec: "alt+l" }); // by position, not the typed character
    expect(rec({ key: "F5", code: "F5" })).toEqual({ spec: "f5" });
    expect(rec({ key: "t", code: "KeyT" })).toHaveProperty("error");
    expect(rec({ key: "t", code: "KeyT", shiftKey: true })).toHaveProperty("error");
    expect(rec({ key: "Escape", code: "Escape", metaKey: true })).toHaveProperty("error");
  });
});

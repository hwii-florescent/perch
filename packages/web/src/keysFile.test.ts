// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePerchStore } from "./store";

const run = vi.fn((_command: string, _args?: unknown) => true);
vi.mock("./modApp", () => ({
  runCommand: (command: string, args?: unknown) => run(command, args),
  commandList: () => [{ id: "session.open", description: "", args: "{id}" }, { id: "layout.resize", description: "", args: "{id, px | weight}" }, { id: "tab.new", description: "", args: "{}" }],
}));
let state: Record<string, unknown> | undefined;
let layout: string | undefined;
vi.mock("./mods", () => ({ currentMods: () => ({ keys: state, layout }) }));

import { handleKey, matches, parseChord } from "./keysFile";

const press = (init: KeyboardEventInit, target: Element = document.body) => {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "target", { value: target });
  return { event, handled: handleKey(event, state) };
};

beforeEach(() => {
  run.mockClear();
  layout = undefined;
  usePerchStore.setState({ toasts: [], sendTerminalInput: vi.fn() });
});
afterEach(() => document.body.replaceChildren());

it("reads herdr's spellings and matches the physical key", () => {
  expect(parseChord("ctrl-shift-t")).toEqual({ ctrl: true, alt: false, shift: true, meta: false, key: "t" });
  expect(parseChord("cmd-shift-]")).toMatchObject({ meta: true, shift: true, key: "]" });
  expect(parseChord("ctrl-pagedown")).toMatchObject({ key: "pagedown" });
  const t = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);
  expect(matches(parseChord("ctrl-shift-t")!, t({ ctrlKey: true, shiftKey: true, key: "T", code: "KeyT" }))).toBe(true);
  expect(matches(parseChord("ctrl-t")!, t({ ctrlKey: true, shiftKey: true, key: "T", code: "KeyT" }))).toBe(false);
  // option+digit types a character on a Mac keyboard; the physical key still matches alt-1.
  expect(matches(parseChord("alt-1")!, t({ altKey: true, key: "¡", code: "Digit1" }))).toBe(true);
  // cmd-} and cmd-shift-] are one press.
  expect(matches(parseChord("cmd-}")!, t({ metaKey: true, shiftKey: true, key: "}", code: "BracketRight" }))).toBe(true);
  expect(matches(parseChord("cmd-shift-]")!, t({ metaKey: true, shiftKey: true, key: "}", code: "BracketRight" }))).toBe(true);
});

it("runs a command, name:value, an object, and a mod's command; the more specific section wins", () => {
  state = {
    global: { "ctrl-shift-t": "tab.new", "alt-1": "session.open:abc", "ctrl-shift-r": { command: "layout.resize", args: { id: "sidebar", px: 240 } }, "ctrl-shift-m": "clock.toggle", "ctrl-shift-x": "tab.new" },
    "layout:terminals": { "ctrl-shift-x": "session.open:fromlayout" },
    terminal: { "ctrl-shift-x": "terminal", "ctrl-shift-s": "send:\u001bb" },
  };
  expect(press({ ctrlKey: true, shiftKey: true, key: "T", code: "KeyT" }).handled).toBe(true);
  expect(run).toHaveBeenLastCalledWith("tab.new", undefined);
  press({ altKey: true, key: "¡", code: "Digit1" });
  expect(run).toHaveBeenLastCalledWith("session.open", { id: "abc" });
  press({ ctrlKey: true, shiftKey: true, key: "R", code: "KeyR" });
  expect(run).toHaveBeenLastCalledWith("layout.resize", { id: "sidebar", px: 240 });
  run.mockImplementation((command) => command === "mod.clock.toggle");
  press({ ctrlKey: true, shiftKey: true, key: "M", code: "KeyM" });
  expect(run).toHaveBeenLastCalledWith("mod.clock.toggle", undefined);
  run.mockImplementation(() => true);

  layout = "terminals";
  press({ ctrlKey: true, shiftKey: true, key: "X", code: "KeyX" });
  expect(run).toHaveBeenLastCalledWith("session.open", { id: "fromlayout" }); // layout over global

  const terminal = document.body.appendChild(document.createElement("div"));
  terminal.dataset.terminalId = "t1";
  run.mockClear();
  expect(press({ ctrlKey: true, shiftKey: true, key: "X", code: "KeyX" }, terminal).handled).toBe(false); // "terminal": the program gets it
  expect(run).not.toHaveBeenCalled();
  expect(press({ ctrlKey: true, shiftKey: true, key: "S", code: "KeyS" }, terminal).handled).toBe(true);
  expect(usePerchStore.getState().sendTerminalInput).toHaveBeenCalledWith("t1", "\u001bb");
});

it("a bad binding shows a toast and does not leak its key; plain keys stay with text fields", () => {
  state = { global: { "ctrl-shift-q": { args: {} }, "ctrl-shift-w": "nonesuch", "ctrl-shift-e": "tab.new:1", "x": "tab.new" } };
  run.mockImplementation((command) => command !== "nonesuch");
  for (const [key, code] of [["Q", "KeyQ"], ["W", "KeyW"], ["E", "KeyE"]] as const) {
    expect(press({ ctrlKey: true, shiftKey: true, key, code }).handled).toBe(true);
  }
  expect(usePerchStore.getState().toasts.map((t) => t.title)).toEqual([
    "keys.json: A binding object needs a command.",
    "keys.json: No command nonesuch.",
    "keys.json: tab.new takes no value.",
  ]);
  const field = document.body.appendChild(document.createElement("input"));
  expect(press({ key: "x", code: "KeyX" }, field).handled).toBe(false);
  expect(press({ key: "x", code: "KeyX" }).handled).toBe(true);
});

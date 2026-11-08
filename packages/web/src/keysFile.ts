/** `keys.json` (beside `mods/`): key bindings by section, the way herdr's file works. Sections are
 * `global`, `layout:<name>` (while that layout shows), `terminal` (a terminal has focus) and
 * `mod:<name>` (that mod's view has focus); the more specific wins. An action is a command
 * (`name` or `name:value`, the value filling its first argument), `send:<text>` (typed into the
 * terminal), `<mod>.<command>` (a command that mod registered), `terminal` (the program gets the
 * key) or `{command, args}`. Keys read `ctrl-shift-t`, `alt-1`, `cmd-shift-]`, `ctrl-pagedown`. */
import { commandList, runCommand } from "./modApp";
import { currentMods } from "./mods";
import { usePerchStore } from "./store";

interface Chord { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; key: string }

const NAMED: Record<string, string> = {
  pageup: "pageup", pagedown: "pagedown", left: "arrowleft", right: "arrowright", up: "arrowup", down: "arrowdown",
  enter: "enter", return: "enter", escape: "escape", esc: "escape", tab: "tab", space: " ", backspace: "backspace",
  delete: "delete", home: "home", end: "end", plus: "+", minus: "-",
};
const MODIFIER = /^(ctrl|control|alt|option|opt|shift|cmd|command|super|meta)-(.+)$/;

export function parseChord(spec: string): Chord | null {
  const chord: Chord = { ctrl: false, alt: false, shift: false, meta: false, key: "" };
  let rest = spec.trim().toLowerCase();
  for (let match = MODIFIER.exec(rest); match; match = MODIFIER.exec(rest)) {
    const name = match[1]!;
    if (name === "ctrl" || name === "control") chord.ctrl = true;
    else if (name === "alt" || name === "option" || name === "opt") chord.alt = true;
    else if (name === "shift") chord.shift = true;
    else chord.meta = true;
    rest = match[2]!;
  }
  chord.key = NAMED[rest] ?? rest;
  return chord.key ? chord : null;
}

/** The key without Shift or Option applied, from the physical key (so `cmd-shift-]` and `alt-1` work on any layout). */
function baseKey(event: KeyboardEvent): string {
  const code = event.code;
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  if (code.startsWith("Digit")) return code.slice(5);
  const punctuation: Record<string, string> = { BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Minus: "-", Equal: "=", Backquote: "`" };
  return punctuation[code] ?? "";
}

export function matches(chord: Chord, event: KeyboardEvent): boolean {
  if (event.ctrlKey !== chord.ctrl || event.altKey !== chord.alt || event.metaKey !== chord.meta) return false;
  const printable = chord.key.length === 1 && !/[a-z0-9]/.test(chord.key);
  // `cmd-}` is the same press as `cmd-shift-]`: a shifted punctuation key may be spelled by what it types.
  if (event.shiftKey !== chord.shift && !(printable && event.key === chord.key)) return false;
  return event.key.toLowerCase() === chord.key || baseKey(event) === chord.key;
}

type Sections = Record<string, Record<string, unknown>>;

const toast = (title: string) =>
  usePerchStore.setState((s) => ({ toasts: [...s.toasts, { id: crypto.randomUUID(), sessionId: "mod:keys", title, level: "error" as const, kind: "usage" as const }] }));

/** Runs `action`; false means the key should still go to whatever has focus. */
function perform(action: unknown, terminalId: string | null): boolean {
  try {
    if (action === "terminal") return false;
    if (action && typeof action === "object" && !Array.isArray(action)) {
      const { command, args } = action as { command?: unknown; args?: unknown };
      if (typeof command !== "string" || !command) throw new Error("A binding object needs a command.");
      if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) throw new Error("args is an object.");
      if (!run(command, args ?? {})) throw new Error(`No command ${command}.`);
      return true;
    }
    if (typeof action !== "string" || !action) throw new Error("An action is a command name, send:<text>, terminal or {command, args}.");
    if (action.startsWith("send:")) {
      if (!terminalId) throw new Error("send: types into a terminal, and none has focus.");
      usePerchStore.getState().sendTerminalInput(terminalId, action.slice(5));
      return true;
    }
    const colon = action.indexOf(":");
    const name = colon < 0 ? action : action.slice(0, colon);
    let args: unknown;
    if (colon >= 0) {
      const first = /^\{\s*([A-Za-z_]\w*)/.exec(commandList().find((c) => c.id === name || c.id === `mod.${name}`)?.args ?? "")?.[1];
      if (!first) throw new Error(`${name} takes no value.`);
      const value = action.slice(colon + 1);
      args = { [first]: /^\d+$/.test(value) && /^(px|weight|index|n|x|y|count)$/.test(first) ? Number(value) : value };
    }
    if (!run(name, args)) throw new Error(`No command ${name}.`);
    return true;
  } catch (error) {
    toast(`keys.json: ${error instanceof Error ? error.message : String(error)}`);
    return true; // a rejected binding does not leak its key to the program
  }
}

/** `name`, or `<mod>.<command>` for a command a mod registered. */
const run = (name: string, args?: unknown) => runCommand(name, args) || (name.includes(".") && runCommand(`mod.${name}`, args));

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) && !target.closest("[data-terminal-id]");

export function handleKey(event: KeyboardEvent, sections: Sections | undefined): boolean {
  if (!sections || event.isComposing || (event.ctrlKey && event.altKey && event.shiftKey && event.key === "Escape")) return false;
  const target = event.target instanceof Element ? event.target : null;
  const terminal = target?.closest("[data-terminal-id]");
  const view = target?.closest('[data-testid^="mod-view-"], [data-testid^="mod-api-window-"]')?.getAttribute("data-testid")?.replace(/^mod-(view|api-window)-/, "");
  const layout = currentMods()?.layout;
  const order = [terminal && "terminal", view && `mod:${view}`, layout && `layout:${layout}`, "global"];
  for (const name of order) {
    const bindings = name ? sections[name] : undefined;
    if (!bindings) continue;
    for (const [spec, action] of Object.entries(bindings)) {
      const chord = parseChord(spec);
      if (!chord || !matches(chord, event)) continue;
      // Plain keys stay with a text field.
      if (!(chord.ctrl || chord.alt || chord.meta) && isTyping(event.target)) continue;
      if (!perform(action, terminal?.getAttribute("data-terminal-id") ?? null)) return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
  }
  return false;
}

/** Listens on the window's capture phase, ahead of the app's own shortcuts, so the file wins. */
export function installKeysFile(): () => void {
  const listener = (event: KeyboardEvent) => void handleKey(event, currentMods()?.keys);
  window.addEventListener("keydown", listener, true);
  return () => window.removeEventListener("keydown", listener, true);
}

/**
 * keyCombo.ts — key combos as strings: "cmd+shift+]", "ctrl+alt+left", "f5".
 * Modifiers (`cmd`, `ctrl`, `shift`, `alt`; `mod` in the built-in defaults =
 * Cmd on a Mac, Ctrl+Shift elsewhere) then one physical key. Digits,
 * punctuation and arrows match by `KeyboardEvent.code`; letters also by `key`
 * so Dvorak/AZERTY follow the layout. Pure: no store, no DOM.
 */

export const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

export interface Combo {
  cmd: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  code: string;
  letter?: string;
}

const CODES: Record<string, string> = {
  "[": "BracketLeft", "]": "BracketRight", ",": "Comma", ".": "Period", "/": "Slash", "\\": "Backslash",
  "-": "Minus", "=": "Equal", "`": "Backquote", ";": "Semicolon", "'": "Quote",
  enter: "Enter", tab: "Tab", space: "Space", backspace: "Backspace", delete: "Delete",
  up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight",
  pageup: "PageUp", pagedown: "PageDown", home: "Home", end: "End",
};
for (let i = 1; i <= 12; i++) CODES[`f${i}`] = `F${i}`;
const TOKENS = Object.fromEntries(Object.entries(CODES).map(([token, code]) => [code, token]));

const LABELS: Record<string, string> = {
  up: "↑", down: "↓", left: "←", right: "→", enter: "Enter", tab: "Tab", space: "Space", backspace: "Backspace",
  delete: "Delete", pageup: "PgUp", pagedown: "PgDn", home: "Home", end: "End",
};

/** The spec token of a physical key: "t", "1", "]", "up". */
export function tokenOf(code: string): string | undefined {
  const plain = /^Key([A-Z])$/.exec(code) ?? /^Digit(\d)$/.exec(code);
  return plain ? plain[1]!.toLowerCase() : TOKENS[code];
}

const cache = new Map<string, Combo>();

/** Throws on an unknown key token, so a typo in a default fails the unit test. */
export function parseCombo(spec: string, mac = IS_MAC): Combo {
  const cacheKey = `${mac}|${spec}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const combo: Combo = { cmd: false, ctrl: false, shift: false, alt: false, code: "" };
  for (const part of spec.split("+")) {
    if (part === "mod") {
      if (mac) combo.cmd = true;
      else { combo.ctrl = true; combo.shift = true; }
    } else if (part === "cmd" || part === "ctrl" || part === "shift" || part === "alt") combo[part] = true;
    else if (/^[a-z]$/.test(part)) { combo.code = `Key${part.toUpperCase()}`; combo.letter = part; }
    else if (/^[0-9]$/.test(part)) combo.code = `Digit${part}`;
    else if (CODES[part]) combo.code = CODES[part];
    else throw new Error(`unknown key "${part}" in "${spec}"`);
  }
  if (!combo.code) throw new Error(`no key in "${spec}"`);
  cache.set(cacheKey, combo);
  return combo;
}

/** Whether `spec` parses; a stale or hand-edited override must not break every keystroke. */
export function validCombo(spec: string): boolean {
  try { parseCombo(spec); return true; } catch { return false; }
}

export function comboMatches(e: KeyboardEvent, c: Combo): boolean {
  if (e.metaKey !== c.cmd || e.ctrlKey !== c.ctrl || e.shiftKey !== c.shift || e.altKey !== c.alt) return false;
  return e.code === c.code || (c.letter !== undefined && !e.altKey && e.key.toLowerCase() === c.letter);
}

/** Same keys, whichever way the spec was written ("mod+t" = "cmd+t" on a Mac). */
export function normalizeCombo(spec: string, mac = IS_MAC): string {
  const c = parseCombo(spec, mac);
  return [c.cmd && "cmd", c.ctrl && "ctrl", c.alt && "alt", c.shift && "shift", c.code].filter(Boolean).join("+");
}

/** "cmd+shift+]" → "⇧⌘]" on a Mac, "Ctrl+Shift+]" elsewhere. */
export function formatCombo(spec: string, mac = IS_MAC): string {
  const c = parseCombo(spec, mac);
  const label = labelOf(tokenOf(c.code) ?? "");
  if (mac) return `${c.ctrl ? "⌃" : ""}${c.alt ? "⌥" : ""}${c.shift ? "⇧" : ""}${c.cmd ? "⌘" : ""}${label}`;
  return [c.ctrl && "Ctrl", c.alt && "Alt", c.shift && "Shift", label].filter(Boolean).join("+");
}

const labelOf = (token: string) => LABELS[token] ?? token.toUpperCase();

/** The key part of a spec as shown ("1" in "cmd+1"). */
export function keyLabel(spec: string): string {
  return labelOf(spec.split("+").pop() ?? "");
}

export type Recorded = { spec: string } | { error: string } | null;

/**
 * A keydown while recording a shortcut. `null` for a bare modifier (keep
 * waiting). A plain key with no Cmd/Ctrl/Alt would swallow ordinary typing, so
 * only the function keys may stand alone.
 */
export function recordCombo(e: KeyboardEvent): Recorded {
  if (["Meta", "Control", "Shift", "Alt"].includes(e.key)) return null;
  const key = tokenOf(e.code);
  if (!key) return { error: "That key can't be used." };
  if (!e.metaKey && !e.ctrlKey && !e.altKey && !/^f\d+$/.test(key)) return { error: IS_MAC ? "Include ⌘, ⌃ or ⌥." : "Include Ctrl or Alt." };
  return { spec: [e.metaKey && "cmd", e.ctrlKey && "ctrl", e.altKey && "alt", e.shiftKey && "shift", key].filter(Boolean).join("+") };
}

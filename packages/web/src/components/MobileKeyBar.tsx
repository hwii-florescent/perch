import type { Terminal } from "@xterm/xterm";
import { cn } from "../lib/cn";
import { GHOST_BUTTON } from "./ui/icon-button";
import { TAP_BUTTON, glass } from "./ui/glass";
import { readClipboardText } from "../nativeApp";

/**
 * The keys a CLI agent asks for that a phone keyboard has no key for: answer a
 * prompt (arrows, Enter), cycle a mode (Shift+Tab), back out (Esc), interrupt
 * (Ctrl+C), the other Ctrl chords (V, P, R, D...) and Paste. Sits under the
 * agent terminal on the phone only.
 *
 * Arrows follow the terminal's cursor-key mode (DECCKM): TUIs that turn it on
 * ignore the plain `CSI` form. A press acts on pointer-down and cancels the
 * default, so the terminal keeps focus and the soft keyboard stays up.
 */
type Key = { label: string; aria: string; seq: (appCursor: boolean) => string };
const key = (label: string, aria: string, seq: string): Key => ({ label, aria, seq: () => seq });
const arrow = (label: string, aria: string, final: string): Key => ({ label, aria, seq: (app) => (app ? "\x1bO" : "\x1b[") + final });
const ctrl = (letter: string): Key => key(`^${letter}`, `Control ${letter}`, String.fromCharCode(letter.charCodeAt(0) - 64));
const PASTE = key("Paste", "Paste", "");

/** Both rows are eight columns wide so the keys line up; the second scrolls for the rest. */
const NAV: Key[] = [
  key("Esc", "Escape", "\x1b"),
  key("Tab", "Tab", "\t"),
  key("\u21e7Tab", "Shift Tab", "\x1b[Z"),
  arrow("\u2191", "Up", "A"),
  arrow("\u2193", "Down", "B"),
  arrow("\u2190", "Left", "D"),
  arrow("\u2192", "Right", "C"),
  key("\u23ce", "Enter", "\r"),
];
// ^V is the agent's own "paste image" key; Paste types the clipboard text.
const CTRL: Key[] = [
  ...["C", "V"].map(ctrl),
  PASTE,
  ...["P", "N", "R", "D", "L", "O", "Z", "U", "W", "A", "E"].map(ctrl),
];

export function MobileKeyBar({ term, send }: { term: Terminal | null; send: (data: string) => void }) {
  const press = (k: Key) => {
    if (k === PASTE) {
      // In a browser this needs a secure page; elsewhere the read is refused and nothing is typed.
      void readClipboardText().then((text) => { if (text) term?.paste(text); }, () => {});
    } else send(k.seq(term?.modes.applicationCursorKeysMode ?? false));
  };
  const keyButton = (k: Key, className?: string) => (
    <button
      key={k.aria}
      type="button"
      aria-label={k.aria}
      className={cn(GHOST_BUTTON, TAP_BUTTON, "min-h-11 p-0 text-[0.85rem]", k.aria === "Control C" && "text-red hover:text-red", className)}
      onPointerDown={(event) => { event.preventDefault(); press(k); }}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); press(k); } }}
    >
      {k.label}
    </button>
  );
  return (
    <div className={cn(glass, "mx-2 mb-1 flex shrink-0 flex-col gap-0.5 p-0.5")} role="toolbar" aria-label="Terminal keys" data-testid="mobile-key-bar">
      <div className="grid grid-cols-8 gap-0.5">{NAV.map((k) => keyButton(k))}</div>
      <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {CTRL.map((k) => keyButton(k, "w-[calc((100%-0.875rem)/8)] shrink-0"))}
      </div>
    </div>
  );
}

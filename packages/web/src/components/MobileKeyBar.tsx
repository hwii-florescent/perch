import type { Terminal } from "@xterm/xterm";
import { cn } from "../lib/cn";
import { GHOST_BUTTON } from "./ui/icon-button";
import { glass } from "./ui/glass";

/**
 * The keys a CLI agent asks for that a phone keyboard has no key for: answer a
 * prompt (arrows, Enter), cycle a mode (Shift+Tab), back out (Esc), interrupt
 * (Ctrl+C). Sits under the agent terminal on the phone only.
 *
 * Arrows follow the terminal's cursor-key mode (DECCKM): TUIs that turn it on
 * ignore the plain `CSI` form. A press acts on pointer-down and cancels the
 * default, so the terminal keeps focus and the soft keyboard stays up.
 */
const KEYS: { label: string; aria: string; seq: (appCursor: boolean) => string }[] = [
  { label: "Esc", aria: "Escape", seq: () => "\x1b" },
  { label: "Tab", aria: "Tab", seq: () => "\t" },
  { label: "\u21e7Tab", aria: "Shift Tab", seq: () => "\x1b[Z" },
  { label: "\u2191", aria: "Up", seq: (app) => (app ? "\x1bOA" : "\x1b[A") },
  { label: "\u2193", aria: "Down", seq: (app) => (app ? "\x1bOB" : "\x1b[B") },
  { label: "\u2190", aria: "Left", seq: (app) => (app ? "\x1bOD" : "\x1b[D") },
  { label: "\u2192", aria: "Right", seq: (app) => (app ? "\x1bOC" : "\x1b[C") },
  { label: "\u23ce", aria: "Enter", seq: () => "\r" },
  { label: "^C", aria: "Control C", seq: () => "\x03" },
];

export function MobileKeyBar({ term, send }: { term: Terminal | null; send: (data: string) => void }) {
  const press = (seq: (appCursor: boolean) => string) => send(seq(term?.modes.applicationCursorKeysMode ?? false));
  return (
    <div className={cn(glass, "mx-2 mb-1 flex shrink-0 gap-0.5 p-0.5")} role="toolbar" aria-label="Terminal keys" data-testid="mobile-key-bar">
      {KEYS.map(({ label, aria, seq }) => (
        <button
          key={aria}
          type="button"
          aria-label={aria}
          className={cn(GHOST_BUTTON, "min-h-11 flex-1 p-0 text-[0.85rem] active:bg-surface-1 active:text-fg", aria === "Control C" && "text-red hover:text-red")}
          onPointerDown={(event) => { event.preventDefault(); press(seq); }}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); press(seq); } }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

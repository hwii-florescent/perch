//! Phone terminal keys, the stock screen `stock:mobile-keys`: the keys a CLI agent asks for that a phone keyboard has
//! no key for: answer a prompt (arrows, Enter), cycle a mode (Shift+Tab), back out (Esc), interrupt (Ctrl+C), the
//! other Ctrl chords (V, P, R, D...) and Paste. Sits under the agent terminal on the phone while it takes typing.
//!
//! Arrows follow the terminal's cursor-key mode (DECCKM, `appCursor()`): TUIs that turn it on ignore the plain `CSI`
//! form. A press acts on pointer-down and cancels the default, so the terminal keeps focus and the soft keyboard stays
//! up. What a key types goes through Perch (`send`, the terminal's own input), never around it.
//!
//! A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for that phone (Settings
//! > Mods).
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-keys` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { cn, ghostButton, glassClass, tapButtonClass, type MobileKeysProps } from "@perch/sdk";

type Key = { label: string; aria: string; seq: (appCursor: boolean) => string };
const key = (label: string, aria: string, seq: string): Key => ({ label, aria, seq: () => seq });
const arrow = (label: string, aria: string, final: string): Key => ({ label, aria, seq: (app) => (app ? "\x1bO" : "\x1b[") + final });
const ctrl = (letter: string): Key => key(`^${letter}`, `Control ${letter}`, String.fromCharCode(letter.charCodeAt(0) - 64));
const PASTE = key("Paste", "Paste", "");

/** Both rows are eight columns wide so the keys line up; the second scrolls for the rest. */
const NAV: Key[] = [
  key("Esc", "Escape", "\x1b"),
  key("Tab", "Tab", "\t"),
  key("⇧Tab", "Shift Tab", "\x1b[Z"),
  arrow("↑", "Up", "A"),
  arrow("↓", "Down", "B"),
  arrow("←", "Left", "D"),
  arrow("→", "Right", "C"),
  key("⏎", "Enter", "\r"),
];
// ^V is the agent's own "paste image" key; Paste types the clipboard text.
const CTRL: Key[] = [
  ...["C", "V"].map(ctrl),
  PASTE,
  ...["P", "N", "R", "D", "L", "O", "Z", "U", "W", "A", "E"].map(ctrl),
];

export default function MobileKeys({ send, paste, appCursor }: MobileKeysProps) {
  const press = (k: Key) => {
    if (k === PASTE) paste();
    else send(k.seq(appCursor()));
  };
  const keyButton = (k: Key, className?: string) => (
    <button
      key={k.aria}
      type="button"
      aria-label={k.aria}
      className={cn(ghostButton, tapButtonClass, "min-h-11 p-0 text-[0.85rem]", k.aria === "Control C" && "text-red hover:text-red", className)}
      onPointerDown={(event) => { event.preventDefault(); press(k); }}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); press(k); } }}
    >
      {k.label}
    </button>
  );
  return (
    <div className={cn(glassClass, "mx-2 mb-1 flex shrink-0 flex-col gap-0.5 p-0.5")} role="toolbar" aria-label="Terminal keys" data-testid="mobile-key-bar">
      <div className="grid grid-cols-8 gap-0.5">{NAV.map((k) => keyButton(k))}</div>
      <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {CTRL.map((k) => keyButton(k, "w-[calc((100%-0.875rem)/8)] shrink-0"))}
      </div>
    </div>
  );
}

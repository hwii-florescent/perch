//! Terminal find, the stock screen `stock:terminal-search`: the find bar over a terminal, opened by the terminal's
//! find key (Settings > Keyboard, `terminal.find`). Perch shows it while find is open, in the top-right corner of the
//! terminal (`.terminal` is `position: relative`), or the person's package chosen for it (`perch mod use
//! stock:terminal-search <id>`) with the same props.
//!
//! Finding is Perch's: `findNext`/`findPrevious` search the terminal's own buffer, and `close` clears the highlight
//! and gives the terminal its focus back. The bar's input is an ordinary input (typing here never reaches the
//! terminal), and the bar never writes to the terminal.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:terminal-search` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import type { TerminalSearchProps } from "@perch/sdk";

const BTN = "h-[1.4rem] w-[1.4rem] shrink-0 rounded-ui bg-surface-1 leading-none text-subtext-0 [font-family:inherit] hover:bg-overlay-0 hover:text-fg";

export default function TerminalSearch({ query, setQuery, findNext, findPrevious, close }: TerminalSearchProps) {
  return (
    <div
      className="absolute top-2 right-3 z-20 flex items-center gap-[0.3rem] rounded-ui bg-surface-1 px-[0.4rem] py-[0.3rem] shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
      data-testid="term-search">
      <input
        type="text"
        autoFocus
        className="w-[11rem] rounded-ui bg-surface-0 px-[0.45rem] py-[0.2rem] text-[0.8rem] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]"
        data-testid="term-search-input"
        placeholder="Find…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // An input method's Enter or Escape belongs to the composition.
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) findPrevious();
            else findNext();
          } else if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
      />
      <button type="button" className={`${BTN} text-[0.75rem]`} title="Previous (Shift+Enter)" onClick={findPrevious}>↑</button>
      <button type="button" className={`${BTN} text-[0.75rem]`} title="Next (Enter)" onClick={findNext}>↓</button>
      <button type="button" className={`${BTN} text-[0.95rem]`} title="Close (Escape)" onClick={close}>×</button>
    </div>
  );
}

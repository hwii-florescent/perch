/**
 * TerminalSearchBar.tsx — find-bar overlay for in-terminal search (Wave 1
 * item 5). Rendered inline (not portaled) inside `.terminal`, which is
 * `position: relative`, so it can sit absolutely-positioned in the
 * top-right corner without escaping the pane.
 */
import type { TerminalSearchController } from "../terminalSearch";

export function TerminalSearchBar({ controller }: { controller: TerminalSearchController }) {
  if (!controller.open) return null;
  return (
    <div className="terminal-search" data-testid="term-search">
      <input
        type="text"
        autoFocus
        className="terminal-search__input"
        data-testid="term-search-input"
        placeholder="Find…"
        value={controller.query}
        onChange={(e) => controller.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) controller.findPrevious();
            else controller.findNext();
          } else if (e.key === "Escape") {
            e.preventDefault();
            controller.close();
          }
        }}
      />
      <button
        type="button"
        className="terminal-search__btn"
        title="Previous (Shift+Enter)"
        onClick={controller.findPrevious}
      >
        ↑
      </button>
      <button type="button" className="terminal-search__btn" title="Next (Enter)" onClick={controller.findNext}>
        ↓
      </button>
      <button
        type="button"
        className="terminal-search__btn terminal-search__btn--close"
        title="Close (Escape)"
        onClick={controller.close}
      >
        ×
      </button>
    </div>
  );
}

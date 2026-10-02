/**
 * TerminalSearchBar.tsx — find-bar overlay for in-terminal search (Wave 1
 * item 5). Rendered inline (not portaled) inside `.terminal`, which is
 * `position: relative`, so it can sit absolutely-positioned in the
 * top-right corner without escaping the pane.
 */
import type { TerminalSearchController } from "../terminalSearch";

const BTN =
  "h-[1.4rem] w-[1.4rem] shrink-0 rounded-ui border border-overlay-0 bg-surface-1 leading-none text-subtext-0 [font-family:inherit] hover:border-accent hover:text-fg";

export function TerminalSearchBar({ controller }: { controller: TerminalSearchController }) {
  if (!controller.open) return null;
  return (
    <div
      className="absolute top-2 right-3 z-20 flex items-center gap-[0.3rem] rounded-ui border border-accent bg-panel-bg px-[0.4rem] py-[0.3rem] shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
      data-testid="term-search">
      <input
        type="text"
        autoFocus
        className="w-[11rem] rounded-ui border border-overlay-0 bg-surface-0 px-[0.45rem] py-[0.2rem] text-[0.8rem] text-fg [font-family:inherit] [outline:none] focus:border-accent"
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
        className={`${BTN} text-[0.75rem]`}
        title="Previous (Shift+Enter)"
        onClick={controller.findPrevious}
      >
        ↑
      </button>
      <button type="button" className={`${BTN} text-[0.75rem]`} title="Next (Enter)" onClick={controller.findNext}>
        ↓
      </button>
      <button
        type="button"
        className={`${BTN} text-[0.95rem]`}
        title="Close (Escape)"
        onClick={controller.close}
      >
        ×
      </button>
    </div>
  );
}

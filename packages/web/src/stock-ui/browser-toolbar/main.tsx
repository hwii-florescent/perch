//! Browser toolbar, the stock screen `stock:browser-toolbar`: the row over a browser page (a tab's, or the drawer's):
//! back, forward, reload, the address with its suggestions (typed text to go to or search for, engine suggestions
//! when the person turned them on, and remembered pages, each removable), and Open externally.
//!
//! The page is Perch's (the engine: the desktop's native webview, or a sandboxed frame without the desktop app), and so
//! are where it goes, what the address holds while typed (it survives this screen being swapped), the suggestions and
//! the keys that walk them (`address.onKeyDown`: arrows, Enter, Escape). This screen draws them and asks; a copy may
//! handle keys itself before or instead of `address.onKeyDown`. Back and Forward need the desktop app (`native`).
//! Perch shows this screen, or the person's package chosen for it (`perch mod use stock:browser-toolbar <id>`), with
//! the same props.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:browser-toolbar` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { cn, ghostButton, PageIcon, type BrowserToolbarProps } from "@perch/sdk";

// No SDK call at a stock source's top level (docs/MOD-SDK.md, "Stock screen sources"): the class is joined when drawn.
const BTN_LOOK = "grid h-7 w-7 shrink-0 place-items-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg max-[700px]:size-11";
const LINE = { fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export default function BrowserToolbar({ native, started, icon, address, onChoose, onRemove, onBack, onForward, onReload, onOpenExternal }: BrowserToolbarProps) {
  const { rows, picked } = address;
  const BTN = cn(ghostButton, BTN_LOOK);
  return (
    <div className="browser-toolbar flex h-[43px] shrink-0 items-center gap-1 bg-surface-0 px-[10px] text-subtext-0 max-[700px]:h-12" data-testid="browser-toolbar">
      <button type="button" className={BTN} title={native ? "Back" : "Back is available in the desktop app"} aria-label="Back" disabled={!native || !started} onClick={onBack}>
        <svg width="15" height="15" viewBox="0 0 20 20" {...LINE}><path d="m12 5-5 5 5 5" /></svg>
      </button>
      <button type="button" className={BTN} title={native ? "Forward" : "Forward is available in the desktop app"} aria-label="Forward" disabled={!native || !started} onClick={onForward}>
        <svg width="15" height="15" viewBox="0 0 20 20" {...LINE}><path d="m8 5 5 5-5 5" /></svg>
      </button>
      <button type="button" className={BTN} title="Reload" aria-label="Reload" disabled={!started} onClick={onReload}>
        <svg width="15" height="15" viewBox="0 0 20 20" {...LINE}><path d="M16 7a6 6 0 1 0 0 6M16 3v4h-4" /></svg>
      </button>
      <div className="relative mx-[11px] flex h-7 min-w-0 flex-1 items-center gap-[7px] rounded-ui bg-[var(--bg)] px-[10px] focus-within:outline focus-within:outline-1 focus-within:outline-fg @max-[460px]:mx-1 max-[700px]:h-9">
        <PageIcon icon={icon} fallback={<svg width="12" height="12" className="shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="10" cy="10" r="7" /><ellipse cx="10" cy="10" rx="3" ry="7" /><path d="M3 10h14" /></svg>} />
        <input
          ref={address.ref}
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls="browser-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={picked >= 0 ? `browser-suggestion-${picked}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent p-0 text-[11px] text-fg [border:0] [font-family:inherit] outline-none placeholder:text-subtext-0"
          aria-label="Address"
          data-testid="browser-address"
          placeholder="Search or enter an address"
          value={address.value}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(event) => address.onChange(event.target.value)}
          onFocus={address.onFocus}
          onMouseUp={address.onMouseUp}
          onBlur={address.onBlur}
          onKeyDown={address.onKeyDown}
        />
        {rows.length > 0 && (
          <ul id="browser-suggestions" role="listbox" aria-label="Suggestions" data-testid="browser-suggestions" className="absolute top-full right-0 left-0 z-50 mt-1 list-none overflow-hidden rounded-ui bg-surface-0 p-1 text-[11px] text-fg shadow-lg">
            {rows.map((row, i) => (
              <li
                key={`${row.kind}:${row.url}`}
                id={`browser-suggestion-${i}`}
                role="option"
                aria-selected={i === picked}
                className={cn("group flex cursor-default items-center gap-2 rounded-ui px-2 py-1", i === picked ? "bg-surface-1" : "hover:bg-surface-1")}
                // mousedown, not click: the input must not blur (closing the list) before the choice lands.
                onMouseDown={(event) => { event.preventDefault(); onChoose(row); }}
              >
                <span className="min-w-0 flex-1 truncate">{row.kind === "search" ? `Search for “${row.title}”` : row.kind === "suggest" ? row.title : row.kind === "go" ? `Go to ${row.title}` : row.title}</span>
                {row.kind === "page" && <span className="min-w-0 max-w-[55%] shrink truncate text-subtext-0">{row.url.replace(/^https?:\/\/(www\.)?/, "")}</span>}
                {row.kind === "page" && (
                  <span
                    role="button"
                    aria-label={`Remove ${row.title} from history`}
                    title="Remove from history"
                    className="shrink-0 px-1 text-subtext-0 opacity-0 group-hover:opacity-100 hover:text-fg"
                    onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); onRemove(row); }}
                  >×</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className={cn(BTN, "w-auto gap-2 px-1 text-[10px] @min-[461px]:flex")} data-testid="browser-open-external" aria-label="Open externally" disabled={!started} onClick={onOpenExternal}>
        <span className="@max-[460px]:hidden">Open externally</span>
        <svg width="14" height="14" viewBox="0 0 20 20" {...LINE}><path d="M11 3h6v6m0-6-8 8m-1-7H4v12h12v-4" /></svg>
      </button>
    </div>
  );
}

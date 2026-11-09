//! Browser, the stock screen `stock:browser`: the drawer's Browser section for one workspace, a strip of its pages
//! (open, switch, close, close all) over the shown one. The pages, their addresses and their webviews are Perch's
//! (`useBrowserPages`, `BrowserPage`): only the shown page is on screen, but every open page keeps its webview, so
//! closing is how its memory comes back. A clone changes the strip, never how pages are kept.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs
//! and `perch mod clone stock:browser` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useState } from "react";
import { BrowserPage, cn, ghostButton, PageIcon, useBrowserPages } from "@perch/sdk";

const BTN = cn(ghostButton, "px-2 py-1 text-[0.75rem]");

function host(url: string): string {
  try { return new URL(url).host || url; } catch { return url; }
}
const pageLabel = (url: string, title = "") => title.trim() || (url ? host(url) : "New page");

export default function Browser({ workspaceId }: { workspaceId: string }) {
  const browser = useBrowserPages(workspaceId);
  const { pages, shownId, tabCount } = browser;
  const shown = pages.find((page) => page.id === shownId);
  const total = pages.length + tabCount;
  // Opening or restoring a workspace must not let a background drawer take the keyboard: only a page the person
  // opened or picked here does.
  const [focusPage, setFocusPage] = useState<string | null>(null);
  const newPage = () => setFocusPage(browser.open());

  return (
    <div className="flex min-w-0 flex-1 flex-col" data-testid="drawer-browser">
      <div className="flex min-h-8 shrink-0 items-center gap-1 overflow-x-auto px-2">
        {pages.map((page) => (
          <span key={page.id} className={cn("flex shrink-0 items-center rounded-ui", page === shown && "bg-surface-1")}>
            <button
              type="button"
              className={cn(ghostButton, "max-w-[10rem] truncate px-2 py-1 text-[0.75rem]", page === shown && "text-fg")}
              data-testid="drawer-browser-page"
              title={page.url || "New page"}
              onClick={() => { browser.select(page.id); setFocusPage(page.id); }}
            >
              <span className="flex items-center gap-1.5">
                {page.icon && <PageIcon icon={page.icon} fallback={null} />}
                <span className="truncate">{pageLabel(page.url, page.title)}</span>
              </span>
            </button>
            <button type="button" className={cn(ghostButton, "px-1 py-1 text-[0.75rem]")} data-testid="drawer-browser-page-close" aria-label={`Close ${pageLabel(page.url, page.title)}`}
              onClick={() => { browser.close(page.id); setFocusPage(pages.filter((other) => other.id !== page.id).at(-1)?.id ?? null); }}>×</button>
          </span>
        ))}
        <button type="button" className={BTN} data-testid="drawer-browser-new" title="New browser page" aria-label="New browser page" onClick={newPage}>+</button>
        {total > 0 && (
          <button
            type="button"
            className={cn(BTN, "ml-auto shrink-0")}
            data-testid="drawer-browser-close-all"
            title={tabCount > 0 ? "Close every browser page and browser tab of this workspace" : "Close every browser page"}
            onClick={() => browser.closeAll()}
          >
            Close all ({total})
          </button>
        )}
      </div>
      {shown ? (
        <BrowserPage key={shown.id} pageId={shown.id} initialUrl={shown.url} active={focusPage === shown.id ? true : undefined} onUrl={(url) => browser.setUrl(shown.id, url)} />
      ) : (
        <div className="flex flex-1 items-start p-4">
          <button type="button" className={cn(BTN, "bg-surface-0")} data-testid="drawer-browser-open" onClick={newPage}>New browser page</button>
        </div>
      )}
    </div>
  );
}

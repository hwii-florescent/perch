import { cn } from "../lib/cn";
import { drawerPageKey, useDrawerBrowsers } from "../drawerBrowsers";
import { useFileTabs } from "../fileTabs";
import { parseUrl } from "../links";
import { WorkspaceBrowser } from "./WorkspaceBrowser";
import { GHOST_BUTTON } from "./ui/icon-button";

const BTN = cn(GHOST_BUTTON, "px-2 py-1 text-[0.75rem]");

const pageLabel = (url: string) => (url ? parseUrl(url)?.host ?? url : "New page");

/** The drawer's Browser section: the workspace's pages as a strip (open, switch, close,
 * close all) over the shown one. Only the shown page is on screen, but every open page
 * keeps its webview, so closing is how its memory comes back. */
export function DrawerBrowser({ workspaceId }: { workspaceId: string }) {
  const allPages = useDrawerBrowsers((s) => s.pages);
  const activeId = useDrawerBrowsers((s) => s.active[workspaceId]);
  const { open, select, setUrl, close, closeAll } = useDrawerBrowsers.getState();
  const tabCount = useFileTabs((s) => s.tabs.filter((tab) => tab.workspaceId === workspaceId && tab.kind === "browser").length);
  const pages = allPages.filter((page) => page.workspaceId === workspaceId);
  const shown = pages.find((page) => page.id === activeId) ?? pages.at(-1);
  const total = pages.length + tabCount;

  return (
    <div className="flex min-w-0 flex-1 flex-col" data-testid="drawer-browser">
      <div className="flex min-h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-b-overlay-0 px-2">
        {pages.map((page) => (
          <span key={page.id} className={cn("flex shrink-0 items-center rounded-ui", page === shown && "bg-surface-1")}>
            <button
              type="button"
              className={cn(GHOST_BUTTON, "max-w-[10rem] truncate px-2 py-1 text-[0.75rem]", page === shown && "text-fg")}
              data-testid="drawer-browser-page"
              title={page.url || "New page"}
              onClick={() => select(workspaceId, page.id)}
            >
              {pageLabel(page.url)}
            </button>
            <button type="button" className={cn(GHOST_BUTTON, "px-1 py-1 text-[0.75rem]")} data-testid="drawer-browser-page-close" aria-label={`Close ${pageLabel(page.url)}`} onClick={() => close(page.id)}>×</button>
          </span>
        ))}
        <button type="button" className={BTN} data-testid="drawer-browser-new" title="New browser page" aria-label="New browser page" onClick={() => open(workspaceId)}>+</button>
        {total > 0 && (
          <button
            type="button"
            className={cn(BTN, "ml-auto shrink-0")}
            data-testid="drawer-browser-close-all"
            title={tabCount > 0 ? "Close every browser page and browser tab of this workspace" : "Close every browser page"}
            onClick={() => closeAll(workspaceId)}
          >
            Close all ({total})
          </button>
        )}
      </div>
      {shown ? (
        <WorkspaceBrowser key={shown.id} tabId={drawerPageKey(shown.id)} initialUrl={shown.url} onUrl={(url) => setUrl(shown.id, url)} />
      ) : (
        <div className="flex flex-1 items-start p-4">
          <button type="button" className={cn(BTN, "bg-surface-0")} data-testid="drawer-browser-open" onClick={() => open(workspaceId)}>New browser page</button>
        </div>
      )}
    </div>
  );
}

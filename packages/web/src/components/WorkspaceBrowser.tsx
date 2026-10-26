import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { browserCall, browserId, nativeBrowser, onPassthrough, passthroughActive } from "../browserNative";
import { browserAddress, openExternal, parseUrl, webUrl } from "../links";
import { useBrowserPages, safeIcon } from "../browserPages";
import { recordPage, removePage, searchHistory, searchSuggestions, type HistoryEntry } from "../browserHistory";
import { addressRows, type AddressRow } from "../addressSuggestions";
import { usePerchStore } from "../store";
import { useZoom } from "../zoom";
import { GHOST_BUTTON } from "./ui/icon-button";
import { PageIcon } from "./PageIcon";

const BTN = cn(GHOST_BUTTON, "grid h-7 w-7 shrink-0 place-items-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg max-[700px]:size-11");

/** What draws over the page in the main web view. A native webview sits above all HTML,
 * so the page is hidden while one of these is up (dialogs, context menus). */
const COVERS = '[role="dialog"], [role="menu"], [role="listbox"], .pane-context-menu__item';

/** perch's lightweight browser. In the desktop app the page is a native child webview laid
 * over `.host` (`browser.rs`): a real browser, so GitHub and every other site works. Without
 * Tauri (the headless web server) it is a sandboxed iframe, which sites that forbid framing
 * show blank; Open externally is always one click away. */
export function WorkspaceBrowser({ tabId, initialUrl, onUrl }: {
  tabId: string;
  /** "" shows an empty address bar (the drawer's browser) and no page until one is entered. */
  initialUrl: string;
  /** Told each address the page reaches, so its owner can keep it. */
  onUrl?: (url: string) => void;
}) {
  const id = browserId(tabId);
  // After a restart the page it last showed (not the address the tab was opened with) comes back.
  const [start] = useState(() => webUrl(useBrowserPages.getState().pages[tabId]?.url ?? "") ?? initialUrl);
  const [url, setUrl] = useState(start);
  const [draft, setDraft] = useState(start);
  const [reloads, setReloads] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(-1);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const editing = useRef(false);
  const justFocused = useRef(false);
  const lastVisit = useRef("");
  const lastSent = useRef("");
  const host = useRef<HTMLDivElement>(null);
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const icon = useBrowserPages((s) => s.pages[tabId]?.icon);
  const searchEngine = usePerchStore((s) => s.settings?.browserSearchEngine);
  const wantSuggestions = usePerchStore((s) => s.settings?.browserSearchSuggestions === true);
  const zoom = useZoom();
  const started = url !== "";
  const latest = useRef(url);
  latest.current = url;
  const report = useRef(onUrl);
  report.current = onUrl;
  useEffect(() => { if (url) report.current?.(url); }, [url]);
  // The core ranks history as the user types; a slow answer for an older query is dropped.
  const typed = dirty ? draft : "";
  useEffect(() => {
    if (!open) return;
    let live = true;
    void searchHistory(typed).then((found) => { if (live) setHistory(found); });
    return () => { live = false; };
  }, [open, typed]);
  // Engine suggestions (opt-in; the core also refuses addresses) are asked for after a short pause
  // so a burst of typing sends one request, not one per key.
  useEffect(() => {
    if (!open || !wantSuggestions || !typed.trim()) { setSuggested([]); return; }
    let live = true;
    const timer = setTimeout(() => { void searchSuggestions(typed).then((found) => { if (live) setSuggested(found); }); }, 150);
    return () => { live = false; clearTimeout(timer); };
  }, [open, wantSuggestions, typed]);
  const rows = open ? addressRows(typed, history, wantSuggestions ? suggested : [], searchEngine) : [];

  // A page this view opened before it was unmounted (switching drawer tabs) is still there.
  useEffect(() => {
    if (nativeBrowser) void browserCall<string>("url", { id }).then((current) => { if (current) { setUrl(current); setDraft(current); } });
  }, [id]);

  // Native: keep the webview on `host`'s rectangle, hidden while covered or unmounted.
  useEffect(() => {
    const el = host.current;
    if (!nativeBrowser || !el || !started) return;
    let last = "";
    let frame = 0;
    let live = true;
    const sync = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const hidden = settingsOpen || r.width < 2 || r.height < 2 || document.querySelector(COVERS) !== null || passthroughActive();
      const next = hidden ? "hidden" : `${r.x},${r.y},${r.width},${r.height}`;
      // zoom is in the effect's deps, so a zoom change re-runs it and `last` starts empty: show re-sends it.
      if (next === last) return;
      last = next;
      void (hidden
        ? browserCall("hide", { id })
        : browserCall("show", { id, url: latest.current, x: r.x, y: r.y, width: r.width, height: r.height, zoom }));
    };
    const schedule = () => { frame ||= requestAnimationFrame(sync); };
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    const unpass = onPassthrough(schedule);
    schedule();
    // The address follows the page's own navigation (links, redirects, back).
    // The tab strip and history follow it too: its title and favicon, kept for the next launch.
    const poll = setInterval(() => {
      void (async () => {
        const current = await browserCall<string>("url", { id });
        if (!current || !live) return;
        if (!editing.current) { setUrl(current); setDraft(current); }
        const info = webUrl(current) ? await browserCall<[string, string]>("info", { id }) : null;
        if (!live || !webUrl(current)) return;
        useBrowserPages.getState().remember(tabId, current, info?.[0], info ? safeIcon(info[1]) : undefined);
        // Once per address or title change, not once per poll.
        const seen = `${current}\n${info?.[0] ?? ""}`;
        if (seen !== lastSent.current) recordPage(current, info?.[0] ?? "", lastVisit.current !== current);
        lastSent.current = seen;
        lastVisit.current = current;
      })();
    }, 1000);
    return () => {
      live = false;
      if (frame) cancelAnimationFrame(frame);
      clearInterval(poll);
      resize.disconnect();
      mutations.disconnect();
      unpass();
      window.removeEventListener("resize", schedule);
      void browserCall("hide", { id });
    };
  }, [id, started, settingsOpen, zoom]);

  const go = (target?: string) => {
    const next = target ?? browserAddress(draft, searchEngine);
    if (!next) return;
    setOpen(false);
    setDirty(false);
    setPicked(-1);
    setUrl(next);
    setDraft(next);
    // Before the first address there is no page yet; becoming `started` shows it at `next`.
    if (nativeBrowser && started) void browserCall("go", { id, url: next });
  };
  const act = (action: "back" | "forward" | "reload") => {
    if (nativeBrowser) void browserCall("action", { id, action });
    else if (action === "reload") setReloads((n) => n + 1);
  };
  // The frame can't be asked for its own address, so it may never show perch itself:
  // a script in a same-origin frame could reach the app. (A native page has no IPC.)
  const choose = (row: AddressRow) => go(row.url);
  const own = !nativeBrowser && parseUrl(url)?.origin === window.location.origin;

  return (
    <div className="@container flex min-w-0 flex-1 flex-col [--radius:var(--radius-pane)]" data-testid="workspace-browser" data-browser-id={id}>
      <div className="browser-toolbar flex h-[43px] shrink-0 items-center gap-1 bg-surface-0 px-[10px] text-subtext-0 max-[700px]:h-12" data-testid="browser-toolbar">
        <button type="button" className={BTN} title={nativeBrowser ? "Back" : "Back is available in the desktop app"} aria-label="Back" disabled={!nativeBrowser || !started} onClick={() => act("back")}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-5 5 5 5" /></svg>
        </button>
        <button type="button" className={BTN} title={nativeBrowser ? "Forward" : "Forward is available in the desktop app"} aria-label="Forward" disabled={!nativeBrowser || !started} onClick={() => act("forward")}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
        </button>
        <button type="button" className={BTN} title="Reload" aria-label="Reload" disabled={!started} onClick={() => act("reload")}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 7a6 6 0 1 0 0 6M16 3v4h-4" /></svg>
        </button>
        <div className="relative mx-[11px] flex h-7 min-w-0 flex-1 items-center gap-[7px] rounded-ui bg-[var(--bg)] px-[10px] focus-within:outline focus-within:outline-1 focus-within:outline-fg @max-[460px]:mx-1 max-[700px]:h-9">
          <PageIcon icon={icon} fallback={<svg width="12" height="12" className="shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="10" cy="10" r="7" /><ellipse cx="10" cy="10" rx="3" ry="7" /><path d="M3 10h14" /></svg>} />
          <input
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="browser-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={picked >= 0 ? `browser-suggestion-${picked}` : undefined}
            className="h-full min-w-0 flex-1 bg-transparent p-0 text-[11px] text-fg [border:0] [font-family:inherit] outline-none placeholder:text-subtext-0"
            aria-label="Address"
            data-testid="browser-address"
            placeholder="Search or enter an address"
            value={draft}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => { setDraft(e.target.value); setDirty(true); setOpen(true); setPicked(-1); }}
            // Like other browsers, focusing selects the whole address. The list opens on typing or ↓, not on focus:
            // it hides the native page, which a plain click into the bar should not do.
            onFocus={(e) => { editing.current = true; justFocused.current = true; e.currentTarget.select(); }}
            onMouseUp={(e) => { if (justFocused.current) e.preventDefault(); justFocused.current = false; }}
            onBlur={() => { editing.current = false; setOpen(false); setDirty(false); setPicked(-1); }}
            onKeyDown={(e) => {
              justFocused.current = false;
              if (e.nativeEvent.isComposing) return;
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (!open) { setOpen(true); return; }
                if (rows.length === 0) return;
                setPicked((i) => (e.key === "ArrowDown" ? (i + 1) % rows.length : (i <= 0 ? rows.length : i) - 1));
              } else if (e.key === "Escape") {
                if (open && rows.length > 0) { e.preventDefault(); setOpen(false); setPicked(-1); }
                else { setDraft(url); setDirty(false); }
              } else if (e.key === "Enter") {
                e.preventDefault();
                const row = rows[picked];
                if (row) choose(row); else go();
              }
            }}
          />
          {rows.length > 0 && (
            <ul id="browser-suggestions" role="listbox" aria-label="Suggestions" data-testid="browser-suggestions" className="absolute top-full right-0 left-0 z-50 mt-1 list-none overflow-hidden rounded-ui border border-overlay-0 bg-surface-0 p-1 text-[11px] text-fg shadow-lg">
              {rows.map((row, i) => (
                <li
                  key={`${row.kind}:${row.url}`}
                  id={`browser-suggestion-${i}`}
                  role="option"
                  aria-selected={i === picked}
                  className={cn("group flex cursor-default items-center gap-2 rounded-ui px-2 py-1", i === picked ? "bg-surface-1" : "hover:bg-surface-1")}
                  // mousedown, not click: the input must not blur (closing the list) before the choice lands.
                  onMouseDown={(e) => { e.preventDefault(); choose(row); }}
                >
                  <span className="min-w-0 flex-1 truncate">{row.kind === "search" ? `Search for “${row.title}”` : row.kind === "suggest" ? row.title : row.kind === "go" ? `Go to ${row.title}` : row.title}</span>
                  {row.kind === "page" && <span className="min-w-0 max-w-[55%] shrink truncate text-subtext-0">{row.url.replace(/^https?:\/\/(www\.)?/, "")}</span>}
                  {row.kind === "page" && (
                    <span
                      role="button"
                      aria-label={`Remove ${row.title} from history`}
                      title="Remove from history"
                      className="shrink-0 px-1 text-subtext-0 opacity-0 group-hover:opacity-100 hover:text-fg"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removePage(row.url); setHistory((found) => found.filter((page) => page.url !== row.url)); }}
                    >×</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" className={cn(BTN, "w-auto gap-2 px-1 text-[10px] @min-[461px]:flex")} data-testid="browser-open-external" aria-label="Open externally" disabled={!started} onClick={() => openExternal(url)}>
          <span className="@max-[460px]:hidden">Open externally</span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 3h6v6m0-6-8 8m-1-7H4v12h12v-4" /></svg>
        </button>
      </div>
      <div ref={host} className="host relative min-h-0 flex-1">
        {!started ? (
          <div className="flex h-full items-center justify-center p-6 text-[12px] text-subtext-0">Search or enter an address above to browse.</div>
        ) : nativeBrowser ? null : own ? (
          <div className="p-4 text-[0.85rem] text-subtext-0">perch's own address can't be shown inside perch.</div>
        ) : (
          <iframe
            key={`${url}\n${reloads}`}
            className="absolute inset-0 h-full w-full bg-[#fff] [border:0]"
            src={url}
            title={url}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { BrowserToolbarProps } from "@perch/sdk";
import { StockRoute } from "./mod-root";
// The toolbar is the stock screen `stock:browser-toolbar` (or the person's copy); the page, its address draft and the
// suggestions stay this file's.
import BrowserToolbar from "../stock-ui/browser-toolbar/main";
import { BROWSER_COVERS, browserAddressDrafts, browserCall, browserHasFocus, browserId, nativeBrowser, noteBrowserFocus, onPassthrough, passthroughActive } from "../browserNative";
import { browserAddress, fileUrl, openExternal, parseUrl, webUrl } from "../links";

/** A page this browser shows: the web, or (desktop) a local file an agent linked. */
const shownUrl = (uri: string) => webUrl(uri) ?? (nativeBrowser ? fileUrl(uri) : null);
import { useBrowserPages, safeIcon } from "../browserPages";
import { recordPage, removePage, searchHistory, searchSuggestions, type HistoryEntry } from "../browserHistory";
import { addressRows, type AddressRow } from "../addressSuggestions";
import { usePerchStore } from "../store";
import { useZoom } from "../zoom";

/** perch's lightweight browser. In the desktop app the page is a native child webview laid
 * over `.host` (`browser.rs`): a real browser, so GitHub and every other site works. Without
 * Tauri (the headless web server) it is a sandboxed iframe, which sites that forbid framing
 * show blank; Open externally is always one click away. */
export function WorkspaceBrowser({ tabId, initialUrl, onUrl, active }: {
  tabId: string;
  /** "" shows an empty address bar (the drawer's browser) and no page until one is entered. */
  initialUrl: string;
  /** Told each address the page reaches, so its owner can keep it. */
  onUrl?: (url: string) => void;
  /** Visible split siblings must not steal focus from the selected pane. */
  active?: boolean;
}) {
  const id = browserId(tabId);
  // After a restart the page it last showed (not the address the tab was opened with) comes back.
  const [start] = useState(() => shownUrl(useBrowserPages.getState().pages[tabId]?.url ?? "") ?? initialUrl);
  const [url, setUrl] = useState(start);
  const [draft, setDraft] = useState(() => browserAddressDrafts.get(id)?.value ?? start);
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
  const address = useRef<HTMLInputElement | null>(null);
  // The address box is the toolbar screen's; it hands its element here (a swapped copy hands its own).
  const setAddress = useCallback((element: HTMLInputElement | null) => { address.current = element; }, []);
  const selected = useRef(active);
  selected.current = active;
  const focusPending = useRef(active === true);
  const schedulePage = useRef<() => void>(() => {});
  useEffect(() => {
    focusPending.current = active === true;
    schedulePage.current();
  }, [active]);
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const icon = useBrowserPages((s) => s.pages[tabId]?.icon);
  const searchEngine = usePerchStore((s) => s.settings?.browserSearchEngine);
  const wantSuggestions = usePerchStore((s) => s.settings?.browserSearchSuggestions === true);
  const zoom = useZoom();
  const presentation = useRef({ settingsOpen, zoom });
  presentation.current = { settingsOpen, zoom };
  useEffect(() => { schedulePage.current(); }, [settingsOpen, zoom]);
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
    if (nativeBrowser) void browserCall<string>("url", { id }).then((current) => { if (current) { setUrl(current); if (!editing.current) setDraft(current); } });
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
      const { settingsOpen, zoom } = presentation.current;
      const hidden = settingsOpen || r.width < 2 || r.height < 2 || document.querySelector(BROWSER_COVERS) !== null || passthroughActive();
      const next = hidden ? "hidden" : `${r.x},${r.y},${r.width},${r.height},${zoom}`;
      const returning = last === "hidden" && browserHasFocus(id);
      if (next !== last) {
        last = next;
        void (hidden
          ? browserCall("hide", { id })
          : browserCall("show", { id, url: latest.current, x: r.x, y: r.y, width: r.width, height: r.height, zoom }));
      }
      if (!hidden && selected.current !== false && !editing.current && (focusPending.current || returning)) {
        void browserCall("focus", { id }, () => {
          if (!live || selected.current === false || editing.current || presentation.current.settingsOpen || document.querySelector(BROWSER_COVERS) || passthroughActive()) return false;
          const bounds = el.getBoundingClientRect();
          if (bounds.width < 2 || bounds.height < 2) return false;
          focusPending.current = false;
          noteBrowserFocus(id);
          return true;
        });
      }
    };
    const schedule = () => { frame ||= requestAnimationFrame(sync); };
    schedulePage.current = schedule;
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
      schedulePage.current = () => {};
      if (frame) cancelAnimationFrame(frame);
      clearInterval(poll);
      resize.disconnect();
      mutations.disconnect();
      unpass();
      window.removeEventListener("resize", schedule);
      void browserCall("hide", { id });
    };
  }, [id, started]);

  useLayoutEffect(() => () => {
    const input = address.current;
    if (input && document.activeElement === input && !browserHasFocus(id)) {
      browserAddressDrafts.set(id, { value: input.value, start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection });
    }
  }, [id, active]);

  useEffect(() => {
    const input = address.current;
    if (!active || settingsOpen || !input) return;
    const saved = browserAddressDrafts.get(id);
    if (!started || saved) {
      input.focus();
      if (saved) input.setSelectionRange(saved.start, saved.end, saved.direction ?? undefined);
      focusPending.current = false;
      browserAddressDrafts.delete(id);
    }
  }, [id, active, started, settingsOpen]);

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
    focusPending.current = true;
    address.current?.blur();
    schedulePage.current();
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
      <StockRoute name="browser-toolbar" stock={BrowserToolbar} props={{
        native: nativeBrowser,
        started,
        icon,
        address: {
          ref: setAddress,
          value: draft,
          rows,
          picked,
          onChange: (value: string) => { setDraft(value); setDirty(true); setOpen(true); setPicked(-1); },
          // Like other browsers, focusing selects the whole address. The list opens on typing or ↓, not on focus:
          // it hides the native page, which a plain click into the bar should not do.
          onFocus: (e: FocusEvent<HTMLInputElement>) => { editing.current = true; justFocused.current = true; e.currentTarget.select(); },
          onMouseUp: (e: MouseEvent<HTMLInputElement>) => { if (justFocused.current) e.preventDefault(); justFocused.current = false; },
          onBlur: () => { editing.current = false; setOpen(false); setDirty(false); setPicked(-1); },
          onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
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
          },
        },
        onChoose: choose,
        onRemove: (row: AddressRow) => { removePage(row.url); setHistory((found) => found.filter((page) => page.url !== row.url)); },
        onBack: () => act("back"),
        onForward: () => act("forward"),
        onReload: () => act("reload"),
        onOpenExternal: () => openExternal(url),
      } satisfies BrowserToolbarProps} />
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

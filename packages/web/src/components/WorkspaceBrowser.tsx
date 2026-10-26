import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { browserCall, browserId, nativeBrowser, onPassthrough, passthroughActive } from "../browserNative";
import { browserAddress, openExternal, parseUrl } from "../links";
import { usePerchStore } from "../store";
import { useZoom } from "../zoom";
import { GHOST_BUTTON } from "./ui/icon-button";

const BTN = cn(GHOST_BUTTON, "grid h-7 w-7 shrink-0 place-items-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg max-[700px]:size-11");

/** What draws over the page in the main web view. A native webview sits above all HTML,
 * so the page is hidden while one of these is up (dialogs, context menus). */
const COVERS = '[role="dialog"], [role="menu"], .pane-context-menu__item';

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
  const [url, setUrl] = useState(initialUrl);
  const [draft, setDraft] = useState(initialUrl);
  const [reloads, setReloads] = useState(0);
  const editing = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const zoom = useZoom();
  const started = url !== "";
  const latest = useRef(url);
  latest.current = url;
  const report = useRef(onUrl);
  report.current = onUrl;
  useEffect(() => { if (url) report.current?.(url); }, [url]);

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
    const poll = setInterval(() => {
      void browserCall<string>("url", { id }).then((current) => {
        if (current && !editing.current) { setUrl(current); setDraft(current); }
      });
    }, 1000);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      clearInterval(poll);
      resize.disconnect();
      mutations.disconnect();
      unpass();
      window.removeEventListener("resize", schedule);
      void browserCall("hide", { id });
    };
  }, [id, started, settingsOpen, zoom]);

  const go = () => {
    const next = browserAddress(draft);
    if (!next) return;
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
  const own = !nativeBrowser && parseUrl(url)?.origin === window.location.origin;

  return (
    <div className="@container flex min-w-0 flex-1 flex-col [--radius:var(--radius-pane)]" data-testid="workspace-browser">
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
        <div className="mx-[11px] flex h-7 min-w-0 flex-1 items-center gap-[7px] rounded-ui bg-[var(--bg)] px-[10px] focus-within:outline focus-within:outline-1 focus-within:outline-fg @max-[460px]:mx-1 max-[700px]:h-9">
          <svg width="12" height="12" className="shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="10" cy="10" r="7" /><ellipse cx="10" cy="10" rx="3" ry="7" /><path d="M3 10h14" /></svg>
          <input
            className="h-full min-w-0 flex-1 bg-transparent p-0 text-[11px] text-fg [border:0] [font-family:inherit] outline-none placeholder:text-subtext-0"
            aria-label="Address"
            data-testid="browser-address"
            placeholder="Search or enter an address"
            value={draft}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => { editing.current = true; }}
            onBlur={() => { editing.current = false; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); go(); } }}
          />
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

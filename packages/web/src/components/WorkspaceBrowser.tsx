import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { browserCall, browserId, nativeBrowser } from "../browserNative";
import { openExternal, parseUrl, webUrl } from "../links";
import { usePerchStore } from "../store";
import { GHOST_BUTTON } from "./ui/icon-button";

const BTN = cn(GHOST_BUTTON, "px-2 py-1 text-[0.8rem]");

/** What draws over the page in the main web view. A native webview sits above all HTML,
 * so the page is hidden while one of these is up (dialogs, context menus). */
const COVERS = '[role="dialog"], [role="menu"], .pane-context-menu__item';

/** perch's lightweight browser. In the desktop app the page is a native child webview laid
 * over `.host` (`browser.rs`): a real browser, so GitHub and every other site works. Without
 * Tauri (the headless web server) it is a sandboxed iframe, which sites that forbid framing
 * show blank; Open externally is always one click away. */
export function WorkspaceBrowser({ tabId, initialUrl }: {
  tabId: string;
  /** "" shows an empty address bar (the drawer's browser) and no page until one is entered. */
  initialUrl: string;
}) {
  const id = browserId(tabId);
  const [url, setUrl] = useState(initialUrl);
  const [draft, setDraft] = useState(initialUrl);
  const [reloads, setReloads] = useState(0);
  const editing = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const started = url !== "";
  const latest = useRef(url);
  latest.current = url;

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
      const hidden = settingsOpen || r.width < 2 || r.height < 2 || document.querySelector(COVERS) !== null;
      const next = hidden ? "hidden" : `${r.x},${r.y},${r.width},${r.height}`;
      if (next === last) return;
      last = next;
      void (hidden
        ? browserCall("hide", { id })
        : browserCall("show", { id, url: latest.current, x: r.x, y: r.y, width: r.width, height: r.height }));
    };
    const schedule = () => { frame ||= requestAnimationFrame(sync); };
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
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
      window.removeEventListener("resize", schedule);
      void browserCall("hide", { id });
    };
  }, [id, started, settingsOpen]);

  const go = () => {
    const next = webUrl(/^[a-z][a-z\d+.-]*:/i.test(draft) ? draft : `http://${draft}`);
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
    <div className="flex min-w-0 flex-1 flex-col" data-testid="workspace-browser">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-b-overlay-0 px-2">
        {nativeBrowser && (
          <>
            <button type="button" className={BTN} title="Back" aria-label="Back" onClick={() => act("back")}>←</button>
            <button type="button" className={BTN} title="Forward" aria-label="Forward" onClick={() => act("forward")}>→</button>
          </>
        )}
        <button type="button" className={BTN} title="Reload" aria-label="Reload" onClick={() => act("reload")}>↻</button>
        <input
          className="min-w-0 flex-1 rounded-ui bg-surface-0 px-2 py-1 text-[0.8rem] text-fg [border:0] [font-family:inherit] outline-none focus-visible:bg-surface-1"
          aria-label="Address"
          data-testid="browser-address"
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => { editing.current = true; }}
          onBlur={() => { editing.current = false; }}
          onKeyDown={(e) => { if (e.key === "Enter") go(); }}
        />
        <button type="button" className={BTN} data-testid="browser-open-external" onClick={() => openExternal(url)}>Open externally</button>
      </div>
      <div ref={host} className="host relative min-h-0 flex-1">
        {!started ? (
          <div className="p-4 text-[0.85rem] text-subtext-0">Enter an address to browse.</div>
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

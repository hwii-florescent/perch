import { useState } from "react";
import { cn } from "../lib/cn";
import { openExternal, parseUrl, webUrl } from "../links";
import { GHOST_BUTTON } from "./ui/icon-button";

const BTN = cn(GHOST_BUTTON, "px-2 py-1 text-[0.8rem]");

/** perch's lightweight browser: a sandboxed frame under an address bar.
 * `allow-same-origin` is for the page's own origin (cookies, localStorage), never perch's:
 * perch's own origin is refused, or a script in the frame could reach the app. A 127.0.0.1
 * page gets an opaque origin instead: the desktop app's IPC capability matches that host
 * (`capabilities/main.json`), and a frame's origin is what Tauri checks. A site that
 * forbids framing (X-Frame-Options) shows blank, so Open externally is always one click away. */
export function WorkspaceBrowser({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [draft, setDraft] = useState(initialUrl);
  const [reloads, setReloads] = useState(0);
  const parsed = parseUrl(url);
  const own = parsed?.origin === window.location.origin;
  const opaque = parsed?.hostname === "127.0.0.1";

  const go = () => {
    const next = webUrl(/^[a-z][a-z\d+.-]*:/i.test(draft) ? draft : `http://${draft}`);
    if (next) { setUrl(next); setDraft(next); }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col" data-testid="workspace-browser">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-b-overlay-0 px-2">
        <button type="button" className={BTN} title="Reload" aria-label="Reload" onClick={() => setReloads((n) => n + 1)}>↻</button>
        <input
          className="min-w-0 flex-1 rounded-ui bg-surface-0 px-2 py-1 text-[0.8rem] text-fg [border:0] [font-family:inherit] outline-none focus-visible:bg-surface-1"
          aria-label="Address"
          data-testid="browser-address"
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") go(); }}
        />
        <button type="button" className={BTN} data-testid="browser-open-external" onClick={() => openExternal(url)}>Open externally</button>
      </div>
      {own ? (
        <div className="p-4 text-[0.85rem] text-subtext-0">perch's own address can't be shown inside perch.</div>
      ) : (
        <iframe
          key={`${url}\n${reloads}`}
          className="min-h-0 w-full flex-1 bg-[#fff] [border:0]"
          src={url}
          title={url}
          sandbox={`allow-scripts ${opaque ? "" : "allow-same-origin "}allow-forms allow-popups allow-modals`}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}

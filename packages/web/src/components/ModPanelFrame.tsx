import { useEffect, useRef } from "react";
import { usePerchStore } from "../store";
import { workspaceRecord } from "../terminalScope";
import { answerPanel } from "../modPanelBridge";
import { GHOST_BUTTON } from "./ui/icon-button";

/** A panel is a page the mod wrote. It runs in a sandboxed iframe with no network and no access to
 * this app (`allow-scripts` only, never `allow-same-origin`); the core also sends it a header that
 * says the same, so opening the URL directly is no different. Overlay and dock both show this. */
export function ModPanelFrame({ title, src, canRead }: { title: string; src: string; canRead: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const workspaceId = usePerchStore((s) => (s.activeWorkspaceId && workspaceRecord(s, s.activeWorkspaceId)?.hostId === "local" ? s.activeWorkspaceId : null));
  // The panel's origin is opaque, so replies go to "*"; only this frame's own messages are answered.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      void answerPanel(event.data, canRead, workspaceId).then((reply) => reply && frame.current?.contentWindow?.postMessage(reply, "*"));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [canRead, workspaceId]);
  return <iframe ref={frame} title={title} src={src} sandbox="allow-scripts" referrerPolicy="no-referrer" className="h-full w-full min-h-0 flex-1 rounded-ui border-0 bg-white" />;
}

export function PanelOverlay({ title, src, canRead, onClose }: { title: string; src: string; canRead: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2100] flex flex-col bg-[rgba(0,0,0,0.55)] p-6" role="dialog" aria-modal="true" aria-label={title} data-testid="mod-panel" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div className="mx-auto flex min-h-0 w-full max-w-[56rem] flex-1 flex-col gap-2 rounded-ui bg-panel-bg p-3">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[0.9rem] font-semibold text-fg">{title}</h2>
          <button type="button" className={GHOST_BUTTON} onClick={onClose} autoFocus>Close</button>
        </div>
        <ModPanelFrame title={title} src={src} canRead={canRead} />
      </div>
    </div>
  );
}

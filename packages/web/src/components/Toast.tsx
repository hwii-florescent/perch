import { useEffect } from "react";
import { usePerchStore } from "../store";

/** How long a toast stays up before auto-dismissing itself. */
const AUTO_DISMISS_MS = 6000;

/** One "session finished" toast. Auto-dismisses after `AUTO_DISMISS_MS`;
 * clicking switches to the session and dismisses immediately. */
function ToastItem({ id, sessionId, title }: { id: string; sessionId: string; title: string }) {
  const switchSession = usePerchStore((s) => s.switchSession);
  const dismissToast = usePerchStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [id, dismissToast]);

  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-2 rounded-ui border border-overlay-0 bg-surface-0 px-[0.8rem] py-[0.55rem] text-left text-[0.8rem] text-fg [font-family:inherit] shadow-[0_4px_16px_rgba(0,0,0,0.35)] animate-toast-in hover:border-accent"
      data-testid={`toast-${sessionId}`}
      onClick={() => {
        switchSession(sessionId);
        dismissToast(id);
      }}
    >
      <span className="size-2 shrink-0 rounded-[50%] bg-teal" aria-hidden="true" />
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
        {title || "(new session)"} finished
      </span>
    </button>
  );
}

/** Corner-anchored stack of "session finished" toasts (Phase 6). Driven
 * entirely by `usePerchStore().toasts`, which `store.ts` populates from
 * client-side observation of `session.updated` running→idle transitions on
 * non-active sessions — no native OS `Notification` API involved. */
export function Toast() {
  const toasts = usePerchStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-4 bottom-4 z-[4000] flex max-w-[min(320px,90vw)] flex-col-reverse gap-2" data-testid="toast">
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} sessionId={t.sessionId} title={t.title} />
      ))}
    </div>
  );
}

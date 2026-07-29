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
      className="toast"
      data-testid={`toast-${sessionId}`}
      onClick={() => {
        switchSession(sessionId);
        dismissToast(id);
      }}
    >
      <span className="toast__dot" aria-hidden="true" />
      <span className="toast__text">
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
    <div className="toast-stack" data-testid="toast">
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} sessionId={t.sessionId} title={t.title} />
      ))}
    </div>
  );
}

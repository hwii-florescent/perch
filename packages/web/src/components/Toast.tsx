import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { usePerchStore, type ToastEntry } from "../store";
import { runCommand } from "../modApp";
import { Slot } from "./Slot";
import { StatusDot } from "./StatusDot";
import { CloseIcon } from "./ui/icons";
import { ICON_BUTTON } from "./ui/icon-button";
import { menuPanel } from "./ui/menu";

/** How long a toast stays up; a blocked session waits longer. Hover or focus pauses it. */
const AUTO_DISMISS_MS = 6000;
const BLOCKED_DISMISS_MS = 10000;
/** Older toasts stay in the store but are not stacked past this many. */
const MAX_VISIBLE = 4;

const LABEL = { done: "Session finished", blocked: "Needs your attention" } as const;

/** One in-app alert: the session's status mark, what happened, and the session
 * name. The card opens the session; the close button only dismisses. */
function ToastItem({ toast }: { toast: ToastEntry }) {
  const switchSession = usePerchStore((s) => s.switchSession);
  const dismissToast = usePerchStore((s) => s.dismissToast);
  const session = usePerchStore((s) => s.sessions.find((x) => x.id === toast.sessionId));
  const [paused, setPaused] = useState(false);
  const usage = toast.kind === "usage";
  const blocked = toast.kind === "blocked";

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismissToast(toast.id), blocked ? BLOCKED_DISMISS_MS : AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, blocked, paused, dismissToast]);

  const heading = usage ? toast.title : blocked ? LABEL.blocked : LABEL.done;
  const detail = usage ? toast.body : toast.title || "(new session)";

  const open = () => {
    if (toast.action) runCommand(toast.action.command, toast.action.args);
    else if (!usage) switchSession(toast.sessionId);
    dismissToast(toast.id);
  };
  const data = { id: toast.id, kind: usage ? "usage" : blocked ? "blocked" : "done", level: toast.level, title: toast.title, body: toast.body, sessionId: toast.sessionId, sessionTitle: session?.title };
  const actions = { open, dismiss: () => dismissToast(toast.id) };
  const ring = toast.level === "error" ? "border-red" : toast.level === "warning" || usage ? "border-yellow" : blocked ? "border-red" : "border-teal";
  return (
    <Slot name="toast" data={data} actions={actions} className="pointer-events-auto">
    <div
      className={cn(menuPanel, "pointer-events-auto flex items-stretch py-0 animate-toast-in motion-reduce:animate-none")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-[0.65rem] bg-transparent px-[0.8rem] py-[0.65rem] text-left text-fg [border:none] [font-family:inherit] hover:bg-surface-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]"
        data-testid={`toast-${toast.sessionId}`}
        onClick={open}
      >
        {session && !usage ? (
          <StatusDot session={session} />
        ) : (
          <span className={cn("inline-flex h-5 w-5 shrink-0 rounded-full border-[1.5px]", ring)} aria-hidden="true" />
        )}
        <span className="min-w-0">
          <span className="block overflow-hidden text-[0.82rem] font-semibold text-ellipsis whitespace-nowrap">{heading}</span>
          {detail && <span className="block overflow-hidden text-[0.75rem] text-ellipsis whitespace-nowrap text-subtext-0">{detail}</span>}
        </span>
      </button>
      <button
        type="button"
        className={cn(ICON_BUTTON, "my-1 mr-1 self-start px-[0.35rem] py-[0.35rem] max-[700px]:min-h-11 max-[700px]:min-w-11")}
        aria-label="Dismiss notification"
        data-testid={`toast-dismiss-${toast.sessionId}`}
        onClick={() => dismissToast(toast.id)}
      >
        <CloseIcon size={12} />
      </button>
    </div>
    </Slot>
  );
}

/** In-app alerts for sessions you are not looking at (and usage alerts), shown
 * while Perch is focused. Top-right on desktop, full-width under the status
 * bar on a phone. Driven by `usePerchStore().toasts`; an unfocused window
 * escalates to a system notification instead (notifications.ts). */
export function Toast() {
  const toasts = usePerchStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] left-[max(0.75rem,env(safe-area-inset-left))] z-[4000] flex flex-col gap-2 min-[701px]:left-auto min-[701px]:w-80"
      role="status"
      aria-live="polite"
      data-testid="toast"
    >
      {toasts.slice(-MAX_VISIBLE).reverse().map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

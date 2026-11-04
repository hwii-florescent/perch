/**
 * Where a "session finished / needs attention" alert goes. Pure so the rule is
 * testable: an in-app toast is invisible while the window is unfocused, so an
 * unfocused window escalates to an OS notification (when permitted) whatever
 * the delivery setting says, and also alerts for the session being viewed.
 */
export type NotifyChannel = "none" | "system" | "toast";

export function planNotification(opts: {
  event: boolean;
  viewed: boolean;
  focused: boolean;
  delivery: string;
  permission: NotificationPermission | "unsupported";
}): NotifyChannel {
  if (!opts.event || opts.delivery === "off") return "none";
  if (opts.viewed && opts.focused) return "none";
  const system = opts.permission === "granted" && (opts.delivery === "system" || !opts.focused);
  return system ? "system" : "toast";
}

/** The window is in front: the document has focus and is visible. */
export function windowFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

export const OPEN_SESSION_EVENT = "perch:open-session";

type Invoke = (cmd: string, args?: unknown) => Promise<unknown>;

/** Show an OS notification for `sessionId`. The desktop shell's `notify_session`
 * focuses the window and fires OPEN_SESSION_EVENT on click; where it is absent
 * (browser, non-macOS) the web/plugin `Notification` is shown, whose click
 * handler works only in a real browser. */
export function sendSystemNotification(title: string, body: string, sessionId: string, onClick: () => void): void {
  const invoke = (window as { __TAURI_INTERNALS__?: { invoke: Invoke } }).__TAURI_INTERNALS__?.invoke;
  const web = () => {
    const notification = new Notification(title, { body, tag: sessionId });
    // The Tauri plugin's Notification may not be a real object, hence the guard.
    if (notification) notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  };
  if (!invoke) return web();
  invoke("notify_session", { title, body, sessionId }).catch(web);
}

/** Ask once for OS permission (the Tauri plugin shows the macOS prompt). */
export function ensureNotificationPermission(): void {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    void Notification.requestPermission().catch(() => undefined);
  }
}

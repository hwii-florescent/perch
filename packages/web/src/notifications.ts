/** Where a session/usage alert goes. Native macOS delivery checks real OS
 * authorization in Rust; the plugin's browser-shaped permission is not evidence. */
export type NotifyChannel = "none" | "system" | "toast";

export function planNotification(opts: {
  event: boolean;
  viewed: boolean;
  focused: boolean;
  delivery: string;
  permission: NotificationPermission | "unsupported";
  native?: boolean;
}): NotifyChannel {
  if (!opts.event || opts.delivery === "off") return "none";
  if (opts.viewed && opts.focused) return "none";
  // A native send can be attempted without a browser grant. Rust checks the
  // actual authorization and rejects to the caller's toast fallback if blocked.
  const system = (opts.native || opts.permission === "granted") && (opts.delivery === "system" || !opts.focused);
  return system ? "system" : "toast";
}

export function windowFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

export const OPEN_SESSION_EVENT = "perch:open-session";
/** Usage and test alerts only raise the window, never open a synthetic session. */
export const USAGE_NOTIFICATION_ID = "usage";

type Invoke = (cmd: string, args?: unknown) => Promise<unknown>;
function nativeInvoke(): Invoke | undefined {
  if (typeof window === "undefined" || !/Mac/.test(navigator.platform)) return;
  return (window as { __TAURI_INTERNALS__?: { invoke: Invoke } }).__TAURI_INTERNALS__?.invoke;
}
export function hasNativeNotifications(): boolean { return Boolean(nativeInvoke()); }

/** Desktop-only fields mirror notify.rs; browser clients report permission alone. */
export interface NotificationSettings {
  permission: NotificationPermission | "unsupported" | "provisional" | "unknown";
  alerts?: boolean;
  alertStyle?: "none" | "banner" | "alert" | "unknown";
  notificationCenter?: boolean;
}

/** Read-only. A failed native check must never fall back to the plugin's fake grant. */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const invoke = nativeInvoke();
  if (invoke) return await invoke("notification_status") as NotificationSettings;
  return { permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission };
}

/** Explicit user action only: never called by a session event or on app startup. */
export async function requestNotificationPermission(): Promise<NotificationSettings> {
  const invoke = nativeInvoke();
  if (invoke) return await invoke("notification_request_permission") as NotificationSettings;
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    await Notification.requestPermission();
  }
  return getNotificationSettings();
}

export async function openNotificationSettings(): Promise<void> {
  const invoke = nativeInvoke();
  if (!invoke) throw new Error("Change notification permissions in your browser settings.");
  await invoke("notification_open_settings");
}

/** Resolve only after the OS accepts the notification, not after a click. Errors
 * reach the caller; retrying through the macOS plugin would hide the same failure. */
export async function sendSystemNotification(title: string, body: string, sessionId: string, onClick: () => void): Promise<void> {
  const invoke = nativeInvoke();
  if (invoke) {
    await invoke("notify_session", { title, body, sessionId });
    return;
  }
  if (typeof Notification === "undefined") throw new Error("System notifications are not supported.");
  const notification = new Notification(title, { body, tag: sessionId });
  // The non-macOS Tauri plugin's Notification may not be a real object.
  if (notification) notification.onclick = () => {
    window.focus();
    onClick();
    notification.close();
  };
}

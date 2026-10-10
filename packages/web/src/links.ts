import { effectiveWorkspace, usePerchStore } from "./store";
import { useFileTabs } from "./fileTabs";

/** `uri` as a URL, or null when it isn't one (stored tab URLs and terminal text are untrusted). */
export function parseUrl(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

/** The http(s) URL `uri` names, or null: a terminal link is untrusted output, so nothing else is opened. */
export function webUrl(uri: string): string | null {
  const url = parseUrl(uri);
  return url && (url.protocol === "http:" || url.protocol === "https:") ? url.href : null;
}

const LOOPBACK = /^(localhost|127\.[\d.]+|0\.0\.0\.0|\[::1?\])$/;

/** True for a URL that names this machine's loopback, which a page loaded here cannot reach on another host. */
export const isLoopback = (url: string) => LOOPBACK.test(parseUrl(url)?.hostname ?? "");

/** Open `url` in the OS default browser. The desktop app has no `window.open`, so it asks the shell. */
export function openExternal(url: string): void {
  const invoke = (window as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__?.invoke;
  if (invoke) void invoke("open_external", { url }).catch(() => {});
  // `noopener` denies the new tab a `window.opener` back-reference to this app.
  // pi-lens-ignore: no-open-redirect
  else window.open(url, "_blank", "noopener");
}

/** A click on a link in a terminal or agent TUI: Cmd/Ctrl+click opens the OS browser,
 * a plain click opens perch's own browser tab in the workspace on screen. */
export function openTerminalLink(event: Pick<MouseEvent, "metaKey" | "ctrlKey">, uri: string): void {
  const url = webUrl(uri);
  if (!url) return;
  const workspace = effectiveWorkspace(usePerchStore.getState());
  // A remote workspace's localhost is not this machine's: opening it here would show the wrong server.
  if (workspace && workspace.hostId !== "local" && isLoopback(url)) return;
  if (event.metaKey || event.ctrlKey || !workspace) openExternal(url);
  else useFileTabs.getState().open(workspace.id, url, "browser");
}

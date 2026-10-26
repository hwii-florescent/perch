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

/** Address-bar input, not terminal output: infer a web address or search for words. */
export function browserAddress(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^https?:/i.test(value)) return webUrl(value);
  // A port is not a scheme: localhost:3000 and example.com:8443 are addresses.
  const hostPort = /^(?:[^\s/:?#]+|\[[^\]]+\]):\d+(?:[/?#]|$)/.test(value);
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !hostPort) return null;
  const url = parseUrl(`https://${value}`);
  if (!/\s/.test(value) && url && (hostPort || url.hostname.includes(".") || url.hostname.startsWith("[") || url.hostname === "localhost")) {
    const host = url.hostname;
    // Dev servers and IP literals commonly have no TLS; explicit HTTPS above is preserved.
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || !host.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return webUrl(`http://${value}`);
    return url.href;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

/** The desktop app's IPC, absent in a plain browser (the headless web server). */
export const tauriInvoke = (window as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__?.invoke;

/** Open `url` in the OS default browser. The desktop app has no `window.open`, so it asks the shell. */
export function openExternal(url: string): void {
  if (tauriInvoke) void tauriInvoke("open_external", { url }).catch(() => {});
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
  if (event.metaKey || event.ctrlKey || !workspace) openExternal(url);
  else useFileTabs.getState().open(workspace.id, url, "browser");
}

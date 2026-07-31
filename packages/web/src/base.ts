/**
 * perch is served under an arbitrary base path: "/" when run locally, or
 * "/proxy/<name>/<port>/" when opened through the devpod gateway from a
 * phone or another machine. Everything here derives that base path (and the
 * matching WS URL) purely from `window.location` at runtime, so a single
 * build (with Vite's relative `base: "./"`) works unmodified everywhere.
 */

/** The base path the app is served from, always with a trailing slash. */
export function getBasePath(): string {
  let path = window.location.pathname;
  if (path.endsWith("index.html")) {
    path = path.slice(0, -"index.html".length);
  }
  if (!path.endsWith("/")) {
    path += "/";
  }
  return path;
}

/** The `{base}ws` WebSocket URL the Rust core listens on (see server.rs). */
export function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${getBasePath()}ws`;
}

/** The `{base}clipboard-image` HTTP upload URL (see server.rs's
 * `clipboard_image_upload` handler) — Wave 2 item 9's clipboard image paste.
 * Local host only: this always targets *this* perch instance's own HTTP
 * server, never a federated remote's (there is no HTTP route to a remote
 * perch — only its WS traffic is tunneled through the hub). */
export function getClipboardImageUploadUrl(ext: string): string {
  return `${window.location.origin}${getBasePath()}clipboard-image?ext=${encodeURIComponent(ext)}`;
}

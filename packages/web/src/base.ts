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

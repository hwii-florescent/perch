import type { BrowserHistoryEntry } from "@perch/shared";
import { newId } from "./ids";
import { parseUrl } from "./links";
import { socket } from "./ws";

/** Pages visited in perch's browser, for address-bar suggestions. The core owns them
 * (`db/browser_history.rs`: validation, ranking, pruning), so every window shares one history.
 * Without the capability (an older core) or a connection, there are simply no suggestions. */
export type HistoryEntry = BrowserHistoryEntry;

const CAPABILITY = "browser.history.v1";
const TIMEOUT_MS = 3000;
let supported = false;
const pending = new Map<string, (entries: HistoryEntry[]) => void>();

function settle(requestId: string, entries: HistoryEntry[]) {
  pending.get(requestId)?.(entries);
  pending.delete(requestId);
}

socket.onMessage((message) => {
  if (message.type === "server.info") supported = message.capabilities?.includes(CAPABILITY) === true;
  else if (message.type === "browser.history.result") settle(message.requestId, message.entries);
});
// A dropped connection never answers: let waiting searches finish empty.
socket.onConnectionChange((connected) => {
  if (!connected) for (const id of [...pending.keys()]) settle(id, []);
});

const ready = () => supported && socket.connected;

/** Note that `url` is on screen; `visit` counts a new visit, otherwise only the title is refreshed. */
export function recordPage(url: string, title: string, visit: boolean) {
  // Not perch's own address: pairing links carry secrets. (The core drops fragments and non-web schemes.)
  if (!ready() || parseUrl(url)?.origin === window.location.origin) return;
  socket.send({ type: "browser.history.record", url, title, visit });
}

/** Pages matching `query`, best first (the most recent when it is empty). */
export function searchHistory(query: string, limit = 6): Promise<HistoryEntry[]> {
  if (!ready()) return Promise.resolve([]);
  const requestId = newId();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => settle(requestId, []), TIMEOUT_MS);
    socket.send({ type: "browser.history.search", requestId, query, limit });
  });
}

export function removePage(url: string) {
  if (ready()) socket.send({ type: "browser.history.remove", url });
}

export function clearHistory() {
  if (ready()) socket.send({ type: "browser.history.clear" });
}

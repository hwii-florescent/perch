import type { BrowserHistoryEntry, ClientMessage } from "@perch/shared";
import { newId } from "./ids";
import { parseUrl } from "./links";
import { socket } from "./ws";

/** What the address bar's dropdown asks the core for: remembered pages and, when the user
 * turned them on, the search engine's suggestions. The core owns both (`db/browser_history.rs`
 * validates, ranks and prunes history; `server/browser_suggest.rs` fetches suggestions), so
 * every window shares one history. Without the capability (an older core) or a connection
 * there is simply nothing to suggest. */
export type HistoryEntry = BrowserHistoryEntry;

const HISTORY = "browser.history.v1";
const SUGGEST = "browser.suggest.v1";
const TIMEOUT_MS = 3000;
let capabilities: string[] = [];
const pending = new Map<string, (answer: never) => void>();

function settle(requestId: string, answer: unknown) {
  pending.get(requestId)?.(answer as never);
  pending.delete(requestId);
}

socket.onMessage((message) => {
  if (message.type === "server.info") capabilities = message.capabilities ?? [];
  else if (message.type === "browser.history.result") settle(message.requestId, message.entries);
  else if (message.type === "browser.suggest.result") settle(message.requestId, message.suggestions);
});
// A dropped connection never answers: let waiting requests finish empty.
socket.onConnectionChange((connected) => {
  if (!connected) for (const id of [...pending.keys()]) settle(id, []);
});

const ready = (capability: string) => capabilities.includes(capability) && socket.connected;

function ask<T>(capability: string, message: (requestId: string) => ClientMessage): Promise<T[]> {
  if (!ready(capability)) return Promise.resolve([]);
  const requestId = newId();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => settle(requestId, []), TIMEOUT_MS);
    socket.send(message(requestId));
  });
}

/** Note that `url` is on screen; `visit` counts a new visit, otherwise only the title is refreshed. */
export function recordPage(url: string, title: string, visit: boolean) {
  // Not perch's own address: pairing links carry secrets. (The core drops fragments and non-web schemes.)
  if (!ready(HISTORY) || parseUrl(url)?.origin === window.location.origin) return;
  socket.send({ type: "browser.history.record", url, title, visit });
}

/** Pages matching `query`, best first (the most recent when it is empty). */
export const searchHistory = (query: string, limit = 6) =>
  ask<HistoryEntry>(HISTORY, (requestId) => ({ type: "browser.history.search", requestId, query, limit }));

/** The search engine's completions of `query`. Empty unless the user enabled search suggestions
 * (the core checks the setting and never sends an address-shaped input). */
export const searchSuggestions = (query: string) =>
  ask<string>(SUGGEST, (requestId) => ({ type: "browser.suggest", requestId, query }));

export function removePage(url: string) {
  if (ready(HISTORY)) socket.send({ type: "browser.history.remove", url });
}

export function clearHistory() {
  if (ready(HISTORY)) socket.send({ type: "browser.history.clear" });
}

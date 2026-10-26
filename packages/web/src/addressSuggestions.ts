import type { HistoryEntry } from "./browserHistory";
import { BROWSER_SEARCH_ENGINES, browserAddress, parseUrl } from "./links";

/** One line of the address bar's dropdown. */
export interface AddressRow {
  /** What Enter on the typed text does ("go" to an address, "search" for words), or a history "page". */
  kind: "go" | "search" | "page";
  /** Where choosing the row navigates. */
  url: string;
  /** The typed text, or the page's title (its host when untitled). */
  title: string;
}

/** The dropdown for `typed` (what the user entered; "" shows recent pages): the typed text's own
 * action first, so Enter on the top row is exactly what Enter did before, then the matching
 * `history` (already ranked by the core). */
export function addressRows(typed: string, history: HistoryEntry[], searchEngine?: string, limit = 6): AddressRow[] {
  const text = typed.trim();
  const target = text ? browserAddress(text, searchEngine) : null;
  const rows: AddressRow[] = [];
  if (target) {
    const engine = BROWSER_SEARCH_ENGINES.find(({ id }) => id === searchEngine) ?? BROWSER_SEARCH_ENGINES[0];
    rows.push({ kind: target.startsWith(`${engine.url}?`) ? "search" : "go", url: target, title: text });
  }
  for (const page of history) {
    if (page.url !== target) rows.push({ kind: "page", url: page.url, title: page.title || parseUrl(page.url)?.host || page.url });
  }
  return rows.slice(0, limit);
}

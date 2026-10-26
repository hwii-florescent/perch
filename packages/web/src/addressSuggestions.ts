import type { HistoryEntry } from "./browserHistory";
import { BROWSER_SEARCH_ENGINES, browserAddress, parseUrl } from "./links";

/** One line of the address bar's dropdown. */
export interface AddressRow {
  /** What Enter on the typed text does ("go" to an address, "search" for words); a search
   * engine "suggest"ion (opens its results); or a remembered "page". */
  kind: "go" | "search" | "suggest" | "page";
  /** Where choosing the row navigates. */
  url: string;
  /** The typed text, the suggested search, or the page's title (its host when untitled). */
  title: string;
}

/** Firefox's composition: the typed text's own action first (so Enter on the top row is exactly
 * what Enter did before), then up to 4 engine suggestions, then history: 3 beside suggestions,
 * the whole remaining room without them. `history` is already ranked by the core; with an empty
 * bar it is the most recent pages. */
export function addressRows(typed: string, history: HistoryEntry[], suggestions: string[], searchEngine?: string, limit = 8): AddressRow[] {
  const text = typed.trim();
  const target = text ? browserAddress(text, searchEngine) : null;
  const rows: AddressRow[] = [];
  if (target) {
    const engine = BROWSER_SEARCH_ENGINES.find(({ id }) => id === searchEngine) ?? BROWSER_SEARCH_ENGINES[0];
    rows.push({ kind: target.startsWith(`${engine.url}?`) ? "search" : "go", url: target, title: text });
  }
  const seen = new Set([text.toLowerCase()]);
  for (const suggestion of suggestions) {
    const search = seen.has(suggestion.toLowerCase()) ? null : browserAddress(suggestion, searchEngine);
    if (!search || rows.filter((row) => row.kind === "suggest").length >= 4) continue;
    seen.add(suggestion.toLowerCase());
    rows.push({ kind: "suggest", url: search, title: suggestion });
  }
  const pages = history.filter((page) => page.url !== target);
  const room = suggestions.length > 0 ? 3 : limit;
  for (const page of pages.slice(0, room)) rows.push({ kind: "page", url: page.url, title: page.title || parseUrl(page.url)?.host || page.url });
  return rows.slice(0, limit);
}

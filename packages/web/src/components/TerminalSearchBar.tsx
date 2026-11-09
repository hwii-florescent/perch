/**
 * TerminalSearchBar.tsx: the find bar over a terminal while find is open. The screen is `stock:terminal-search`
 * (`stock-ui/terminal-search/main.tsx`) or the person's package chosen for it; the search itself, and giving the
 * terminal its focus back on close, stay `terminalSearch.ts`'s. Rendered inline inside `.terminal`. A phone keeps
 * Perch's own.
 */
import type { TerminalSearchProps } from "@perch/sdk";
import type { TerminalSearchController } from "../terminalSearch";
import { useIsMobileWidth } from "../responsive";
import TerminalSearch from "../stock-ui/terminal-search/main";
import { StockRoute } from "./mod-root";

export function TerminalSearchBar({ controller }: { controller: TerminalSearchController }) {
  const exact = useIsMobileWidth();
  if (!controller.open) return null;
  const { query, setQuery, findNext, findPrevious, close } = controller;
  const props: TerminalSearchProps = { query, setQuery, findNext, findPrevious, close };
  return <StockRoute name="terminal-search" props={props} stock={TerminalSearch} exact={exact} />;
}

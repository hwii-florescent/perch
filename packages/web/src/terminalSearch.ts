/**
 * terminalSearch.ts — Wave 1 item 5: in-terminal search via
 * `@xterm/addon-search`, shared between `views/Terminal.tsx` and
 * `views/AgentCliTerminal.tsx`.
 *
 * Ctrl/Cmd+F opens a find-bar overlay while a terminal pane is focused.
 * Implemented via `term.attachCustomKeyEventHandler` rather than a DOM-level
 * keydown listener: xterm registers that handler ahead of its own key
 * evaluation and calls it once per keydown on *that terminal's* hidden
 * textarea, so the shortcut is naturally scoped to "this pane is focused"
 * (only the focused terminal's textarea receives the event at all), and
 * returning `false` both lets us `preventDefault()` the browser's native
 * find dialog and stops xterm from also sending Ctrl+F through as literal
 * PTY input.
 */
import { useEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import { SearchAddon } from "@xterm/addon-search";

export interface TerminalSearchController {
  open: boolean;
  query: string;
  setQuery: (q: string) => void;
  findNext: () => void;
  findPrevious: () => void;
  close: () => void;
}

export function useTerminalSearch(term: Terminal | null): TerminalSearchController {
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const [query, setQuery] = useState("");

  // Load the SearchAddon once the terminal instance exists.
  useEffect(() => {
    if (!term) return;
    const addon = new SearchAddon();
    term.loadAddon(addon);
    searchAddonRef.current = addon;
    return () => {
      searchAddonRef.current = null;
      addon.dispose();
    };
  }, [term]);

  // Intercept Ctrl/Cmd+F (open) and Escape (close, only while open) before
  // xterm's own key handling.
  useEffect(() => {
    if (!term) return;
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setOpen(true);
        return false;
      }
      if (e.key === "Escape" && openRef.current) {
        e.preventDefault();
        setOpen(false);
        searchAddonRef.current?.clearActiveDecoration();
        return false;
      }
      return true;
    });
  }, [term]);

  function findNext() {
    if (query) searchAddonRef.current?.findNext(query);
  }
  function findPrevious() {
    if (query) searchAddonRef.current?.findPrevious(query);
  }
  function close() {
    setOpen(false);
    searchAddonRef.current?.clearActiveDecoration();
    term?.focus();
  }

  return { open, query, setQuery, findNext, findPrevious, close };
}

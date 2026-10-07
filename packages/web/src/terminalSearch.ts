/**
 * terminalSearch.ts — Wave 1 item 5: in-terminal search via
 * `@xterm/addon-search`, shared between `views/Terminal.tsx` and
 * `views/AgentCliTerminal.tsx`.
 *
 * Cmd+F opens a find-bar overlay while a terminal pane is focused (all of the
 * terminal shortcuts, Settings > Keyboard, are the `terminal.*` ids of keybinds.ts).
 * Implemented via `term.attachCustomKeyEventHandler` rather than a DOM-level
 * keydown listener: xterm registers that handler ahead of its own key
 * evaluation and calls it once per keydown on *that terminal's* hidden
 * textarea, so the shortcut is naturally scoped to "this pane is focused"
 * (only the focused terminal's textarea receives the event at all), and
 * returning `false` both lets us `preventDefault()` the browser's native
 * find dialog. Ctrl+F is left to the PTY (readline's forward-char), as in
 * Ghostty and iTerm2. The same handler owns the terminal-only shortcuts that
 * need the xterm instance: Cmd+K clears, Cmd+Up/Down scroll to the top/bottom
 * (Ctrl+Shift instead of Cmd off macOS).
 */
import { useEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import { SearchAddon } from "@xterm/addon-search";
import { shortcutFor, terminalKeyHandler } from "./keybinds";

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

  // Intercept Cmd+F (open) and Escape (close, only while open) before
  // xterm's own key handling.
  useEffect(() => {
    if (!term) return;
    term.attachCustomKeyEventHandler((e) => {
      const direct = e.type === "keydown" ? shortcutFor(e, true) : undefined;
      if (direct?.scope === "terminal") {
        e.preventDefault();
        if (direct.id === "terminal.find") setOpen(true);
        else if (direct.id === "terminal.clear") term.clear();
        else if (direct.id === "terminal.scrollTop") term.scrollToTop();
        else if (direct.id === "terminal.scrollBottom") term.scrollToBottom();
        return false;
      }
      if (e.type === "keydown" && e.key === "Escape" && openRef.current) {
        e.preventDefault();
        setOpen(false);
        searchAddonRef.current?.clearActiveDecoration();
        return false;
      }
      return terminalKeyHandler(e);
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

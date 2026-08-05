import { useEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { usePerchStore } from "../store";
import { onTerminalData } from "../terminalBus";
import { createPerchTerminal, type PerchTerminal } from "../xtermSetup";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";

export function TerminalView({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const perchTermRef = useRef<PerchTerminal | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [termInstance, setTermInstance] = useState<Terminal | null>(null);
  const search = useTerminalSearch(termInstance);

  const createTerminal = usePerchStore((s) => s.createTerminal);
  const sendTerminalInput = usePerchStore((s) => s.sendTerminalInput);
  const killTerminal = usePerchStore((s) => s.killTerminal);
  const exitCode = usePerchStore((s) =>
    terminalId ? (s.terminals[terminalId]?.exitCode ?? null) : null,
  );

  // Create the xterm instance + backing PTY exactly once. The view stays
  // mounted across tab switches (see App.tsx) so this never re-runs while
  // the tab is merely hidden. Kill the backing PTY/shell on unmount (panel
  // closed, or the whole terminal group closed via Bug 3's toggle) so
  // closing a terminal tab doesn't leak a shell process — previously nothing
  // ever terminated this PTY server-side.
  useEffect(() => {
    if (!containerRef.current) return;
    // The terminal keeps itself fitted to its container (ResizeObserver
    // inside `createPerchTerminal`); this callback only forwards the new grid
    // to the PTY, and `terminalIdRef` is read lazily because the first fits
    // happen before the create round-trip resolves.
    const perchTerm = createPerchTerminal(
      containerRef.current,
      (cols, rows) => {
        const id = terminalIdRef.current;
        if (id) usePerchStore.getState().resizeTerminal(id, cols, rows);
      },
      usePerchStore.getState().terminalProfile,
    );
    const term = perchTerm.term;
    xtermRef.current = term;
    perchTermRef.current = perchTerm;
    setTermInstance(term);

    let disposed = false;
    let currentId: string | null = null;
    createTerminal(term.cols, term.rows).then((id) => {
      if (disposed) {
        // Unmounted before the create round-trip resolved — kill it rather
        // than leaking an orphaned shell process no view will ever attach to.
        killTerminal(id);
        return;
      }
      currentId = id;
      terminalIdRef.current = id;
      setTerminalId(id);
    });

    const dataSub = term.onData((data) => {
      if (currentId) sendTerminalInput(currentId, data);
    });

    // Wave 2 item 9: paste a clipboard image -> upload -> type its staged
    // path into the PTY (see clipboardImagePaste.ts).
    const detachClipboardPaste = containerRef.current
      ? attachClipboardImagePaste(containerRef.current, () => terminalIdRef.current)
      : () => {};

    return () => {
      disposed = true;
      detachClipboardPaste();
      dataSub.dispose();
      perchTerm.dispose();
      if (currentId) killTerminal(currentId);
    };
    // Deliberately run once: creating a PTY per mount, not per prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stream PTY output straight into xterm, bypassing React state.
  useEffect(() => {
    if (!terminalId) return;
    return onTerminalData(terminalId, (data) => xtermRef.current?.write(data));
  }, [terminalId]);

  // Container-size changes are handled by the ResizeObserver inside
  // `createPerchTerminal`. This only covers the one transition it can miss:
  // becoming the active tab again at exactly the size we were hidden at, so
  // no resize event ever fires — but the emulator may still owe the PTY a
  // sync (fits taken while the pane measured 0x0 are skipped by design).
  useEffect(() => {
    if (!active) return;
    perchTermRef.current?.fit();
  }, [active, terminalId]);

  return (
    <div className="terminal">
      <div className="terminal__surface" ref={containerRef} />
      <TerminalSearchBar controller={search} />
      {exitCode !== null && (
        <div className="terminal__exited">process exited (code {exitCode})</div>
      )}
    </div>
  );
}

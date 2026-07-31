import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { usePerchStore } from "../store";
import { onTerminalData } from "../terminalBus";
import { xtermThemeFromTokens } from "../themes";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";

export function TerminalView({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [termInstance, setTermInstance] = useState<Terminal | null>(null);
  const search = useTerminalSearch(termInstance);

  const createTerminal = usePerchStore((s) => s.createTerminal);
  const sendTerminalInput = usePerchStore((s) => s.sendTerminalInput);
  const resizeTerminal = usePerchStore((s) => s.resizeTerminal);
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
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      theme: xtermThemeFromTokens(),
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
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
      term.dispose();
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

  // Re-fit whenever the pane becomes visible or the viewport changes (tab
  // switch, phone rotation, gateway window resize).
  useEffect(() => {
    const refit = () => {
      if (!active) return;
      const fitAddon = fitAddonRef.current;
      const term = xtermRef.current;
      if (!fitAddon || !term) return;
      fitAddon.fit();
      if (terminalId) resizeTerminal(terminalId, term.cols, term.rows);
    };
    refit();
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, [active, terminalId, resizeTerminal]);

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

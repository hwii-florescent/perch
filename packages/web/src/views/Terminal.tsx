import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { usePerchStore } from "../store";
import { onTerminalData } from "../terminalBus";

export function TerminalView({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);

  const createTerminal = usePerchStore((s) => s.createTerminal);
  const sendTerminalInput = usePerchStore((s) => s.sendTerminalInput);
  const resizeTerminal = usePerchStore((s) => s.resizeTerminal);
  const exitCode = usePerchStore((s) =>
    terminalId ? (s.terminals[terminalId]?.exitCode ?? null) : null,
  );

  // Create the xterm instance + backing PTY exactly once. The view stays
  // mounted across tab switches (see App.tsx) so this never re-runs while
  // the tab is merely hidden.
  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      theme: { background: "#0b0d10", foreground: "#e6e6e6" },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    let disposed = false;
    let currentId: string | null = null;
    createTerminal(term.cols, term.rows).then((id) => {
      if (disposed) return;
      currentId = id;
      setTerminalId(id);
    });

    const dataSub = term.onData((data) => {
      if (currentId) sendTerminalInput(currentId, data);
    });

    return () => {
      disposed = true;
      dataSub.dispose();
      term.dispose();
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
      {exitCode !== null && (
        <div className="terminal__exited">process exited (code {exitCode})</div>
      )}
    </div>
  );
}

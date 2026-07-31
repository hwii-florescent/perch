import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { AgentKind } from "@perch/shared";
import { usePerchStore } from "../store";
import { onTerminalData } from "../terminalBus";
import { xtermThemeFromTokens } from "../themes";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";

export function AgentCliTerminal({
  sessionId,
  agent,
  cliError,
  onExitCli,
}: {
  sessionId: string;
  agent: AgentKind;
  cliError?: string | null;
  onExitCli?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [termInstance, setTermInstance] = useState<Terminal | null>(null);
  const search = useTerminalSearch(termInstance);

  const attachAgentCli = usePerchStore((s) => s.attachAgentCli);
  const sendTerminalInput = usePerchStore((s) => s.sendTerminalInput);
  const resizeTerminal = usePerchStore((s) => s.resizeTerminal);
  const killTerminal = usePerchStore((s) => s.killTerminal);
  const exitCode = usePerchStore((s) =>
    terminalId ? (s.terminals[terminalId]?.exitCode ?? null) : null,
  );

  // Create (or reattach to) the PTY exactly once per mount, and kill it again
  // on unmount. Root cause of the Hosted->CLI->Hosted->CLI "lags and never
  // renders" bug: leaving CLI mode never terminated the spawned
  // `claude --resume` process, so a still-alive PTY sat there with no
  // listener; terminalBus.ts drops any output emitted while unsubscribed
  // (no buffering/replay), and xterm.js itself has no way to redraw a
  // process's current screen from nothing. Re-entering CLI mode created a
  // brand-new, blank xterm instance and reattached to that same live PTY
  // (attachAgentCli only respawns when the cached terminal's exitCode is
  // non-null) — so the new xterm just sat there waiting for the next output
  // byte, which might not come for a long time (or ever, if the CLI's ink
  // renderer has nothing new to repaint). Explicitly killing the PTY here
  // (via the new terminal.kill protocol message) and evicting it from the
  // store's cliTerminalIds cache guarantees every CLI-mode entry gets a
  // *fresh* attach — a fresh process paired with a fresh xterm, which always
  // renders its own initial screen correctly. Session/model continuity is
  // unaffected: the server resumes the same claude session id either way.
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
    attachAgentCli(sessionId, agent).then((id) => {
      if (disposed) {
        // Unmounted before the attach round-trip resolved — the PTY was
        // still spawned server-side, so kill it now rather than leaking an
        // orphaned CLI process no view will ever attach to.
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
    // Deliberately run once per mount: sessionId/agent are fixed for the
    // lifetime of this component instance (key prop in Chat.tsx ensures a
    // remount when session or agent changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Stream PTY output straight into xterm, bypassing React state.
  useEffect(() => {
    if (!terminalId) return;
    return onTerminalData(terminalId, (data) => xtermRef.current?.write(data));
  }, [terminalId]);

  // Re-fit on mount and viewport changes.
  useEffect(() => {
    const refit = () => {
      const fitAddon = fitAddonRef.current;
      const term = xtermRef.current;
      if (!fitAddon || !term) return;
      fitAddon.fit();
      if (terminalId) resizeTerminal(terminalId, term.cols, term.rows);
    };
    refit();
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, [terminalId, resizeTerminal]);

  return (
    <div className="terminal">
      <div className="terminal__surface" ref={containerRef} />
      <TerminalSearchBar controller={search} />
      {cliError && (
        <div className="terminal__cli-error">{cliError}</div>
      )}
      {exitCode !== null && (
        <div className="terminal__exited" onClick={onExitCli} style={onExitCli ? { cursor: "pointer" } : undefined}>
          process exited (code {exitCode})
        </div>
      )}
    </div>
  );
}

import { PersistentAgentTerminal } from "./PersistentAgentTerminal";
import { useEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { AgentKind } from "@perch/shared";
import { usePerchStore } from "../store";
import { onTerminalData } from "../terminalBus";
import { createPerchTerminal, type PerchTerminal } from "../xtermSetup";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";

function LegacyAgentCliTerminal({
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
  const perchTermRef = useRef<PerchTerminal | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [termInstance, setTermInstance] = useState<Terminal | null>(null);
  // Bumped by "Restart CLI" — the attach effect below keys off it, so a bump
  // tears down the dead xterm+PTY pair and builds a fresh one (see the effect
  // comment for why a *fresh* xterm, not a reattach, is the only thing that
  // renders correctly).
  const [restartNonce, setRestartNonce] = useState(0);
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
    const perchTerm = createPerchTerminal(
      containerRef.current,
      (cols, rows) => {
        const id = terminalIdRef.current;
        if (id) usePerchStore.getState().resizeTerminal(id, cols, rows);
      },
      // Read at construction time rather than subscribed: the profile is sent
      // once per connection and never changes mid-session, and xterm takes
      // its font/theme at construction anyway.
      usePerchStore.getState().terminalProfile,
    );
    const term = perchTerm.term;
    xtermRef.current = term;
    perchTermRef.current = perchTerm;
    setTermInstance(term);

    let disposed = false;
    let currentId: string | null = null;
    // Spawn the CLI already sized to this pane. Attaching at a hardcoded
    // 80x24 and resizing afterwards made the agent draw its first frame at
    // the wrong width and then reflow — visible as a garbled banner that only
    // straightened out on the next full repaint.
    attachAgentCli(sessionId, agent, term.cols, term.rows).then((id) => {
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
      perchTerm.dispose();
      if (currentId) killTerminal(currentId);
    };
    // Deliberately re-run only on mount and on an explicit "Restart CLI"
    // (`restartNonce`): sessionId/agent are fixed for the lifetime of this
    // component instance (key prop in Chat.tsx ensures a remount when session
    // or agent changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartNonce]);

  /** "Restart CLI" — respawn the agent CLI in place after its process exited.
   * Without this the pane is a dead end: the xterm still shows whatever the
   * CLI left on screen (usually a cleared screen after `/exit`), keystrokes go
   * to a pty whose child is gone, and the only escape is switching the global
   * chat mode or creating another session. */
  function restartCli() {
    terminalIdRef.current = null;
    setTerminalId(null);
    setRestartNonce((n) => n + 1);
  }


  // Stream PTY output straight into xterm, bypassing React state.
  useEffect(() => {
    if (!terminalId) return;
    return onTerminalData(terminalId, (data) => xtermRef.current?.write(data));
  }, [terminalId]);

  // Container-size changes are handled by the ResizeObserver inside
  // `createPerchTerminal`; this only syncs the PTY once the terminal id
  // finally exists, since fits that completed before then had no id to
  // forward the new grid to.
  useEffect(() => {
    if (!terminalId) return;
    const term = xtermRef.current;
    if (term) resizeTerminal(terminalId, term.cols, term.rows);
  }, [terminalId, resizeTerminal]);

  return (
    <div className="terminal">
      <div className="terminal__surface" ref={containerRef} />
      <TerminalSearchBar controller={search} />
      {cliError && (
        <div className="terminal__cli-error">{cliError}</div>
      )}
      {exitCode !== null && (
        <div className="terminal__exited terminal__exited--cli" data-testid="cli-exited">
          <span className="terminal__exited-text">
            {agent} exited (code {exitCode})
          </span>
          <span className="terminal__exited-actions">
            <button
              type="button"
              className="terminal__exited-btn terminal__exited-btn--primary"
              data-testid="cli-restart"
              onClick={restartCli}
            >
              Restart CLI
            </button>
            {onExitCli && (
              <button
                type="button"
                className="terminal__exited-btn"
                data-testid="cli-back-to-hosted"
                onClick={onExitCli}
              >
                Back to Hosted
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export function AgentCliTerminal(props: { sessionId: string; agent: string; cliError?: string | null; onExitCli?: () => void }) {
  const persistent = usePerchStore((state) => {
    const hostId = state.sessions.find((session) => session.id === props.sessionId)?.hostId ?? state.activeHostId;
    return hostId === "local" && state.serverInfo?.capabilities?.includes("agent.terminal.open") === true;
  });
  if (persistent) return <PersistentAgentTerminal {...props} />;
  if (props.agent === "claude" || props.agent === "codex") return <LegacyAgentCliTerminal {...props} agent={props.agent} />;
  return <div className="terminal__cli-error" role="alert">This host does not support configured CLI providers.</div>;
}
